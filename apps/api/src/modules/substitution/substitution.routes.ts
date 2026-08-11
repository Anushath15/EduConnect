import { FastifyInstance } from "fastify"

import { authenticateWithTenant } from "../../core/middleware/tenant.middleware.js"
import { requirePermission } from "../../core/middleware/rbac.middleware.js"

import { substitutionService } from "./substitution.service.js"

export async function substitutionRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/v1/substitutions/available-teachers",
    { preHandler: [authenticateWithTenant, requirePermission("substitution:assign")] },
    async (request, reply) => {
      const { date, periodId } = request.query as { date: string; periodId: string }
      if (!date || !periodId) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "date and periodId are required" },
        })
      }
      const teachers = await substitutionService.findAvailableTeachers(
        request.user.schoolId,
        new Date(date),
        periodId
      )
      return reply.status(200).send({ success: true, data: teachers })
    }
  )

  fastify.post(
    "/v1/substitutions/mark-absent",
    { preHandler: [authenticateWithTenant, requirePermission("substitution:assign")] },
    async (request, reply) => {
      const { absentTeacherId, date, slotIds } = request.body as {
        absentTeacherId: string
        date: string
        slotIds: string[]
      }
      if (!absentTeacherId || !date || !slotIds?.length) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "absentTeacherId, date and slotIds are required" },
        })
      }
      const result = await substitutionService.markAbsent(
        request.user.schoolId,
        absentTeacherId,
        new Date(date),
        slotIds,
        request.user.userId
      )
      return reply.status(201).send({ success: true, data: result })
    }
  )

  fastify.post(
    "/v1/substitutions/:id/assign",
    { preHandler: [authenticateWithTenant, requirePermission("substitution:assign")] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { substituteTeacherId } = request.body as { substituteTeacherId: string }
      if (!substituteTeacherId) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "substituteTeacherId is required" },
        })
      }
      const result = await substitutionService.assignSubstitute(
        id,
        substituteTeacherId,
        request.user.schoolId
      )
      return reply.status(200).send({ success: true, data: result })
    }
  )

  fastify.post(
    "/v1/substitutions/:id/respond",
    { preHandler: [authenticateWithTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { action } = request.body as { action: "accept" | "decline" }
      if (!action || !["accept","decline"].includes(action)) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "action must be accept or decline" },
        })
      }
      await substitutionService.respond(
        id,
        request.user.userId,
        action,
        request.user.schoolId
      )
      return reply.status(200).send({ success: true, data: { message: "Response recorded" } })
    }
  )

  fastify.get(
    "/v1/substitutions",
    { preHandler: [authenticateWithTenant] },
    async (request, reply) => {
      const { page = "1", limit = "20" } = request.query as { page?: string; limit?: string }
      const result = await substitutionService.getHistory(
        request.user.schoolId,
        parseInt(page),
        parseInt(limit)
      )
      return reply.status(200).send({
        success: true,
        data: result.data,
        meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages },
      })
    }
  )
}
