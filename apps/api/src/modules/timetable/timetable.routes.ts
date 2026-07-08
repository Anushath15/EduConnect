import { FastifyInstance } from "fastify"
import { timetableService } from "./timetable.service.js"
import { authenticateWithTenant } from "../../core/middleware/tenant.middleware.js"
import { requirePermission } from "../../core/middleware/rbac.middleware.js"

export async function timetableRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    "/v1/timetable/generate",
    {
      preHandler: [authenticateWithTenant, requirePermission("timetable:generate")],
      // Timetable generation is expensive: 5 calls per school per 10 min
      config: { rateLimit: { max: 5, timeWindow: "10 minutes", keyGenerator: (req: any) => req.user?.schoolId ?? req.ip } },
    },
    async (request, reply) => {
      const { weekStartDate } = request.body as { weekStartDate: string }
      if (!weekStartDate) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "weekStartDate is required (YYYY-MM-DD)" },
        })
      }
      const result = await timetableService.generate(
        request.user.schoolId,
        new Date(weekStartDate)
      )
      return reply.status(200).send({ success: true, data: result })
    }
  )

  fastify.get(
    "/v1/timetable",
    { preHandler: [authenticateWithTenant, requirePermission("timetable:view:all")] },
    async (request, reply) => {
      const { weekStartDate } = request.query as { weekStartDate: string }
      if (!weekStartDate) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "weekStartDate query param is required" },
        })
      }
      const slots = await timetableService.getWeekTimetable(
        request.user.schoolId,
        new Date(weekStartDate)
      )
      return reply.status(200).send({ success: true, data: slots })
    }
  )

  fastify.post(
    "/v1/timetable/assign-subject",
    { preHandler: [authenticateWithTenant, requirePermission("timetable:edit")] },
    async (request, reply) => {
      const { teacherId, subjectId } = request.body as {
        teacherId: string
        subjectId: string
      }
      if (!teacherId || !subjectId) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "teacherId and subjectId are required" },
        })
      }
      const result = await timetableService.assignSubjectToTeacher(
        request.user.schoolId,
        teacherId,
        subjectId
      )
      return reply.status(200).send({ success: true, data: result })
    }
  )

  fastify.get(
    "/v1/timetable/assignments",
    { preHandler: [authenticateWithTenant] },
    async (request, reply) => {
      const data = await timetableService.getTeacherAssignments(request.user.schoolId)
      return reply.status(200).send({ success: true, data })
    }
  )
}