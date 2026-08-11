import type { FastifyInstance } from "fastify"
import { z } from "zod"
import { hash, argon2id } from "argon2"

import { db } from "../../core/database/prisma.js"
import { Errors } from "../../core/errors/AppError.js"
import { authenticateWithTenant } from "../../core/middleware/tenant.middleware.js"
import { requirePermission } from "../../core/middleware/rbac.middleware.js"
import { invalidatePermissionCache } from "../../core/permissions/checker.js"

const passwordSchema = z
  .string()
  .min(8,    "Password must be at least 8 characters")
  .regex(/[A-Z]/,        "Must contain an uppercase letter")
  .regex(/[a-z]/,        "Must contain a lowercase letter")
  .regex(/[0-9]/,        "Must contain a number")
  .regex(/[^A-Za-z0-9]/, "Must contain a special character")

const ALL_ROLES = [
  "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR", "ADMINISTRATOR",
  "CLASS_TEACHER", "SUBJECT_TEACHER", "TEMP_TEACHER", "INTERN", "OFFICE_STAFF",
] as const

const createSchema = z.object({
  name:              z.string().min(2).max(100),
  email:             z.string().email("Invalid email address"),
  password:          passwordSchema,
  role:              z.enum(ALL_ROLES),
  phone:             z.string().max(20).optional(),
  preferredLanguage: z.enum(["en", "ta"]).default("en"),
})

const updateSchema = z.object({
  name:              z.string().min(2).max(100).optional(),
  phone:             z.string().max(20).nullable().optional(),
  preferredLanguage: z.enum(["en", "ta"]).optional(),
  role:              z.enum(ALL_ROLES).optional(),
  isActive:          z.boolean().optional(),
})

const safeSelect = {
  id: true, name: true, email: true, role: true, phone: true,
  preferredLanguage: true, avatarUrl: true, isActive: true,
  createdAt: true, schoolId: true, lastLoginAt: true,
} as const

export async function staffRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/v1/staff", {
    preHandler: [authenticateWithTenant, requirePermission("staff:view")],
  }, async (request, reply) => {
    const staff = await db.user.findMany({
      where:   { schoolId: request.user.schoolId, isActive: true },
      select:  safeSelect,
      orderBy: [{ role: "asc" }, { name: "asc" }],
    })
    return reply.send({ success: true, data: staff })
  })

  fastify.post("/v1/staff", {
    preHandler: [authenticateWithTenant, requirePermission("staff:create")],
    config: { rateLimit: { max: 20, timeWindow: "10 minutes" } },
  }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message } })
    }
    const exists = await db.user.findUnique({ where: { email: parsed.data.email } })
    if (exists) throw Errors.DUPLICATE("Email")
    const passwordHash = await hash(parsed.data.password, { type: argon2id })
    const user = await db.user.create({
      data: {
        schoolId: request.user.schoolId,
        name:     parsed.data.name,
        email:    parsed.data.email,
        passwordHash,
        role:              parsed.data.role,
        phone:             parsed.data.phone,
        preferredLanguage: parsed.data.preferredLanguage,
      },
      select: safeSelect,
    })
    return reply.status(201).send({ success: true, data: user })
  })

  fastify.patch("/v1/staff/:id", {
    preHandler: [authenticateWithTenant, requirePermission("staff:edit")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = updateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message } })
    }

    const existing = await db.user.findFirst({
      where: { id, schoolId: request.user.schoolId },
      select: { id: true, isActive: true, role: true },
    })
    if (!existing) throw Errors.NOT_FOUND("Staff member")

    // Only an active staff member can be edited. If we're re-activating, the
    // target record must already exist.
    if (!existing.isActive && parsed.data.isActive !== true) {
      throw Errors.NOT_FOUND("Staff member")
    }

    // SECURITY: if the role changes, invalidate the target user's permission
    // cache immediately so the change is effective on their next request.
    const roleChanging = parsed.data.role !== undefined && parsed.data.role !== existing.role

    const updated = await db.user.update({
      where: { id },
      data:  parsed.data,
      select: safeSelect,
    })

    if (roleChanging || parsed.data.isActive === false) {
      await invalidatePermissionCache(id).catch(() => {
        // Best-effort: a Redis outage must not block the write, but we log it.
        request.log.warn({ userId: id }, "Failed to invalidate permission cache")
      })
    }

    return reply.send({ success: true, data: updated })
  })

  fastify.delete("/v1/staff/:id", {
    preHandler: [authenticateWithTenant, requirePermission("staff:edit")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    if (id === request.user.userId) {
      return reply.status(400).send({ success: false,
        error: { code: "SELF_DEACTIVATION", message: "You cannot deactivate your own account" } })
    }
    const existing = await db.user.findFirst({
      where: { id, schoolId: request.user.schoolId, isActive: true },
    })
    if (!existing) throw Errors.NOT_FOUND("Staff member")
    await db.user.update({ where: { id }, data: { isActive: false } })
    // Invalidate the deactivated user's cached permissions immediately.
    await invalidatePermissionCache(id).catch(() => {})
    return reply.send({ success: true, data: { message: "Staff member deactivated" } })
  })

  fastify.post("/v1/staff/:id/reset-password", {
    preHandler: [authenticateWithTenant, requirePermission("staff:edit")],
  }, async (request, reply) => {
    const { id }  = request.params as { id: string }
    const { newPassword } = request.body as { newPassword?: string }
    const valid = passwordSchema.safeParse(newPassword)
    if (!valid.success) {
      return reply.status(400).send({ success: false,
        error: { code: "VALIDATION_ERROR", message: valid.error.errors[0].message } })
    }
    const existing = await db.user.findFirst({ where: { id, schoolId: request.user.schoolId } })
    if (!existing) throw Errors.NOT_FOUND("Staff member")
    const passwordHash = await hash(valid.data, { type: argon2id })
    await db.$transaction([
      db.user.update({ where: { id }, data: { passwordHash } }),
      // Invalidate all sessions on every device (security best practice).
      db.refreshToken.deleteMany({ where: { userId: id } }),
    ])
    // Wipe Redis-side session caches too.
    await invalidatePermissionCache(id).catch(() => {})
    return reply.send({ success: true, data: { message: "Password updated successfully" } })
  })
}
