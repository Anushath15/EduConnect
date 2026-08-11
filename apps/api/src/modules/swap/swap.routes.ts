import { FastifyInstance } from "fastify"
import { z } from "zod"

import { authenticateWithTenant } from "../../core/middleware/tenant.middleware.js"
import { requirePermission } from "../../core/middleware/rbac.middleware.js"

import { swapService } from "./swap.service.js"


const createSwapSchema = z.object({
  requesterSlotId: z.string().uuid("requesterSlotId must be a valid UUID"),
  receiverSlotId:  z.string().uuid("receiverSlotId must be a valid UUID"),
  message:         z.string().max(500).optional(),
})

const respondSchema = z.object({
  action:        z.enum(["accept", "decline"]),
  declineReason: z.string().max(500).optional(),
})

export async function swapRoutes(fastify: FastifyInstance) {

  // POST /v1/swaps — request a swap
  fastify.post("/v1/swaps", {
    preHandler: [authenticateWithTenant, requirePermission("swap:request")],
  }, async (request, reply) => {
    const parsed = createSwapSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message } })
    }
    const result = await swapService.createSwapRequest(
      request.user.schoolId,
      request.user.userId,
      parsed.data.requesterSlotId,
      parsed.data.receiverSlotId,
      parsed.data.message
    )
    return reply.status(201).send({ success: true, data: result })
  })

  // GET /v1/swaps?view=sent|received|all
  fastify.get("/v1/swaps", {
    preHandler: [authenticateWithTenant],
  }, async (request, reply) => {
    const { view = "all" } = request.query as { view?: "sent" | "received" | "all" }
    const result = await swapService.listSwaps(
      request.user.schoolId,
      request.user.userId,
      view
    )
    return reply.send({ success: true, data: result })
  })

  // POST /v1/swaps/:id/respond — accept or decline
  fastify.post("/v1/swaps/:id/respond", {
    preHandler: [authenticateWithTenant],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = respondSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message } })
    }
    const result = await swapService.respond(
      id,
      request.user.userId,
      request.user.schoolId,
      parsed.data.action,
      parsed.data.declineReason
    )
    return reply.send({ success: true, data: result })
  })

  // DELETE /v1/swaps/:id — cancel own request
  fastify.delete("/v1/swaps/:id", {
    preHandler: [authenticateWithTenant],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await swapService.cancel(id, request.user.userId, request.user.schoolId)
    return reply.send({ success: true, data: { message: "Swap request cancelled" } })
  })
}