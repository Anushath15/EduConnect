import { FastifyInstance } from "fastify"
import { z } from "zod"
import type { UserRole } from "@prisma/client"

import { authenticateWithTenant } from "../../core/middleware/tenant.middleware.js"
import { requirePermission } from "../../core/middleware/rbac.middleware.js"
import { db } from "../../core/database/prisma.js"

const ROLE_VALUES = [
  "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR", "ADMINISTRATOR",
  "CLASS_TEACHER", "SUBJECT_TEACHER", "TEMP_TEACHER", "INTERN", "OFFICE_STAFF",
] as const

const announcementSchema = z.object({
  title:      z.string().min(1).max(200),
  body:       z.string().min(1).max(5000),
  targetRole: z.enum(ROLE_VALUES).optional(),
})

const updateAnnouncementSchema = announcementSchema.partial()

async function canModify(announcementId: string, schoolId: string, userId: string, userRole: string) {
  const existing = await db.announcement.findFirst({ where: { id: announcementId, schoolId } })
  if (!existing) return { existing: null, allowed: false }
  const allowed = existing.authorId === userId || userRole === "PRINCIPAL" || userRole === "VICE_PRINCIPAL"
  return { existing, allowed }
}

export async function announcementsRoutes(fastify: FastifyInstance) {

  fastify.get("/v1/announcements", {
    preHandler: [authenticateWithTenant],
  }, async (request, reply) => {
    const { page = "1", limit = "20" } = request.query as { page?: string; limit?: string }
    const pageNum  = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const skip     = (pageNum - 1) * limitNum
    const where = {
      schoolId: request.user.schoolId,
      OR: [{ targetRole: null }, { targetRole: request.user.role as UserRole }],
    }
    const [data, total] = await Promise.all([
      db.announcement.findMany({
        where,
        include: { author: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "desc" },
        skip, take: limitNum,
      }),
      db.announcement.count({ where }),
    ])
    return reply.send({
      success: true, data,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    })
  })

  fastify.post("/v1/announcements", {
    preHandler: [authenticateWithTenant, requirePermission("announcement:create")],
  }, async (request, reply) => {
    const parsed = announcementSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message },
      })
    }
    const announcement = await db.announcement.create({
      data: {
        schoolId: request.user.schoolId,
        authorId: request.user.userId,
        ...parsed.data,
      },
      include: { author: { select: { id: true, name: true, role: true } } },
    })
    return reply.status(201).send({ success: true, data: announcement })
  })

  fastify.put("/v1/announcements/:id", {
    preHandler: [authenticateWithTenant, requirePermission("announcement:create")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = updateAnnouncementSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message },
      })
    }
    const { allowed, existing } = await canModify(id, request.user.schoolId, request.user.userId, request.user.role)
    if (!existing) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Announcement not found" } })
    if (!allowed) return reply.status(403).send({ success: false, error: { code: "PERMISSION_DENIED", message: "Only the author or a Principal/Vice Principal can edit this announcement" } })
    const updated = await db.announcement.update({
      where: { id },
      data: parsed.data,
      include: { author: { select: { id: true, name: true, role: true } } },
    })
    return reply.send({ success: true, data: updated })
  })

  fastify.delete("/v1/announcements/:id", {
    preHandler: [authenticateWithTenant, requirePermission("announcement:create")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { allowed, existing } = await canModify(id, request.user.schoolId, request.user.userId, request.user.role)
    if (!existing) return reply.status(404).send({ success: false, error: { code: "NOT_FOUND", message: "Announcement not found" } })
    if (!allowed) return reply.status(403).send({ success: false, error: { code: "PERMISSION_DENIED", message: "Only the author or a Principal/Vice Principal can delete this announcement" } })
    await db.announcement.delete({ where: { id } })
    return reply.send({ success: true, data: { message: "Announcement deleted" } })
  })
}