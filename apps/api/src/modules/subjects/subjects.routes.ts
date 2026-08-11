import { FastifyInstance } from "fastify"
import { z } from "zod"

import { db } from "../../core/database/prisma.js"
import { Errors } from "../../core/errors/AppError.js"
import { authenticateWithTenant } from "../../core/middleware/tenant.middleware.js"
import { requirePermission } from "../../core/middleware/rbac.middleware.js"

// ── Zod schemas ──────────────────────────────────────────────────────────────

const createSchema = z.object({
  name:           z.string().min(1).max(100),
  code:           z.string().min(1).max(10),
  colorHex:       z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").default("#7C6FFF"),
  periodsPerWeek: z.number().int().min(1).max(20).default(5),
})

const patchSchema = z.object({
  name:           z.string().min(1).max(100).optional(),
  colorHex:       z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  periodsPerWeek: z.number().int().min(1).max(20).optional(),
})

// ── Helpers ──────────────────────────────────────────────────────────────────

async function findOwnedSubjectOrThrow(id: string, schoolId: string) {
  const subject = await db.subject.findFirst({ where: { id, schoolId, isActive: true } })
  if (!subject) throw Errors.NOT_FOUND("Subject")
  return subject
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function subjectsRoutes(fastify: FastifyInstance) {

  fastify.get("/v1/subjects", {
    preHandler: [authenticateWithTenant],
  }, async (request, reply) => {
    const subjects = await db.subject.findMany({
      where:   { schoolId: request.user.schoolId, isActive: true },
      orderBy: { name: "asc" },
    })
    return reply.send({ success: true, data: subjects })
  })

  fastify.post("/v1/subjects", {
    preHandler: [authenticateWithTenant, requirePermission("school:config")],
  }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message },
      })
    }
    try {
      const subject = await db.subject.create({
        data: {
          schoolId: request.user.schoolId,
          ...parsed.data,
          code: parsed.data.code.toUpperCase(),
        },
      })
      return reply.status(201).send({ success: true, data: subject })
    } catch (err: any) {
      if (err.code === "P2002") throw Errors.DUPLICATE("Subject code")
      throw err
    }
  })

  /**
   * Update subject name, color, or periods-per-week.
   * Code is immutable after creation to preserve references.
   */
  fastify.patch("/v1/subjects/:id", {
    preHandler: [authenticateWithTenant, requirePermission("school:config")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = patchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message },
      })
    }
    await findOwnedSubjectOrThrow(id, request.user.schoolId)
    const subject = await db.subject.update({ where: { id }, data: parsed.data })
    return reply.send({ success: true, data: subject })
  })

  /**
   * Soft-delete a subject.
   *
   * Fixed C-002: previously queried db.subject.update({ where: { id } }) with no
   * schoolId filter. An admin from School A could deactivate School B's subjects.
   */
  fastify.delete("/v1/subjects/:id", {
    preHandler: [authenticateWithTenant, requirePermission("school:config")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await findOwnedSubjectOrThrow(id, request.user.schoolId)
    await db.subject.update({ where: { id }, data: { isActive: false } })
    return reply.send({ success: true, data: { message: "Subject deactivated" } })
  })
}