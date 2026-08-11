import { FastifyInstance } from "fastify"

import { authenticateWithTenant } from "../../core/middleware/tenant.middleware.js"
import { requirePermission } from "../../core/middleware/rbac.middleware.js"

import { resourceService } from "./resource.service.js"

export async function resourceRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/v1/resources",
    { preHandler: [authenticateWithTenant] },
    async (request, reply) => {
      const data = await resourceService.listResources(request.user.schoolId)
      return reply.status(200).send({ success: true, data })
    }
  )

  fastify.post(
    "/v1/resources",
    { preHandler: [authenticateWithTenant, requirePermission("school:config")] },
    async (request, reply) => {
      const { name, type, capacity } = request.body as { name: string; type: string; capacity?: number }
      if (!name || !type) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "name and type are required" },
        })
      }
      const data = await resourceService.createResource(request.user.schoolId, { name, type, capacity })
      return reply.status(201).send({ success: true, data })
    }
  )

  fastify.delete(
    "/v1/resources/:id",
    { preHandler: [authenticateWithTenant, requirePermission("school:config")] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await resourceService.deactivateResource(request.user.schoolId, id)
      return reply.status(200).send({ success: true, data: { message: "Resource deactivated" } })
    }
  )

  fastify.get(
    "/v1/resource-bookings",
    { preHandler: [authenticateWithTenant, requirePermission("resource:book")] },
    async (request, reply) => {
      const { weekStartDate } = request.query as { weekStartDate: string }
      if (!weekStartDate) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "weekStartDate query param is required" },
        })
      }
      const data = await resourceService.getWeekBookings(request.user.schoolId, new Date(weekStartDate))
      return reply.status(200).send({ success: true, data })
    }
  )

  fastify.post(
    "/v1/resource-bookings",
    { preHandler: [authenticateWithTenant, requirePermission("resource:book")] },
    async (request, reply) => {
      const { resourceId, periodId, dayOfWeek, weekStartDate, purpose } = request.body as {
        resourceId: string; periodId: string; dayOfWeek: string; weekStartDate: string; purpose?: string
      }
      if (!resourceId || !periodId || !dayOfWeek || !weekStartDate) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "resourceId, periodId, dayOfWeek and weekStartDate are required" },
        })
      }
      const data = await resourceService.createBooking(
        request.user.schoolId,
        request.user.userId,
        resourceId,
        periodId,
        dayOfWeek,
        new Date(weekStartDate),
        purpose
      )
      return reply.status(201).send({ success: true, data })
    }
  )

  fastify.delete(
    "/v1/resource-bookings/:id",
    { preHandler: [authenticateWithTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await resourceService.cancelBooking(request.user.schoolId, id, request.user.userId)
      return reply.status(200).send({ success: true, data: { message: "Booking cancelled" } })
    }
  )
}
