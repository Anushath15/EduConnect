import { FastifyInstance } from "fastify"
import { z } from "zod"

import { authenticateWithTenant } from "../../core/middleware/tenant.middleware.js"
import { requirePermission } from "../../core/middleware/rbac.middleware.js"
import { db } from "../../core/database/prisma.js"

const schoolConfigSchema = z.object({
  periodsPerDay: z.number().min(1).max(12),
  workingDays: z.array(z.enum(["MON","TUE","WED","THU","FRI","SAT"])).min(1),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  freePeriodsPerTeacherPerWeek: z.number().min(0).max(10),
  breakPeriods: z.array(z.number()).default([]),
})

export async function schoolRoutes(fastify: FastifyInstance) {

  // GET /v1/school/config
  fastify.get("/v1/school/config", {
    preHandler: [authenticateWithTenant],
  }, async (request, reply) => {
    const school = await db.school.findUnique({
      where: { id: request.user.schoolId },
      select: { id: true, name: true, email: true, config: true },
    })
    return reply.send({ success: true, data: school })
  })

  // PUT /v1/school/config
  fastify.put("/v1/school/config", {
    preHandler: [
      authenticateWithTenant,
      requirePermission("school:config"),
    ],
  }, async (request, reply) => {
    const parsed = schoolConfigSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message },
      })
    }
    const school = await db.school.update({
      where: { id: request.user.schoolId },
      data: { config: parsed.data },
      select: { id: true, name: true, config: true },
    })
    return reply.send({ success: true, data: school })
  })

  // GET /v1/school/stats
  fastify.get("/v1/school/stats", {
    preHandler: [authenticateWithTenant],
  }, async (request, reply) => {
    const schoolId = request.user.schoolId
    const [teachers, classes, subjects] = await Promise.all([
      db.user.count({ where: { schoolId, isActive: true } }),
      db.class.count({ where: { schoolId, isActive: true } }),
      db.subject.count({ where: { schoolId, isActive: true } }),
    ])
    return reply.send({ success: true, data: { teachers, classes, subjects } })
  })
}
