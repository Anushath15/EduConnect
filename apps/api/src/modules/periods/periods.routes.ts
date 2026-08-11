import { FastifyInstance } from "fastify"
import { z } from "zod"

import { db } from "../../core/database/prisma.js"
import { Errors, AppError } from "../../core/errors/AppError.js"
import { authenticateWithTenant } from "../../core/middleware/tenant.middleware.js"
import { requirePermission } from "../../core/middleware/rbac.middleware.js"

// ── Zod schema ───────────────────────────────────────────────────────────────

const createSchema = z
  .object({
    periodNumber: z.number().int().min(1).max(12),
    label:        z.string().min(1).max(50),
    startTime:    z.string().regex(/^\d{2}:\d{2}$/, "startTime must be HH:MM"),
    endTime:      z.string().regex(/^\d{2}:\d{2}$/, "endTime must be HH:MM"),
    isBreak:      z.boolean().default(false),
  })
  .refine((d) => d.startTime < d.endTime, {
    message: "startTime must be before endTime",
    path:    ["endTime"],
  })

// ── Helpers ──────────────────────────────────────────────────────────────────

async function findOwnedPeriodOrThrow(id: string, schoolId: string) {
  const period = await db.periodDefinition.findFirst({ where: { id, schoolId } })
  if (!period) throw Errors.NOT_FOUND("Period")
  return period
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function periodsRoutes(fastify: FastifyInstance) {

  fastify.get("/v1/periods", {
    preHandler: [authenticateWithTenant],
  }, async (request, reply) => {
    const periods = await db.periodDefinition.findMany({
      where:   { schoolId: request.user.schoolId },
      orderBy: { periodNumber: "asc" },
    })
    return reply.send({ success: true, data: periods })
  })

  /**
   * Create a new period definition.
   *
   * Fixed H-005: overlap check and insert are now inside a single $transaction.
   * Previously the check was done in application code with no transaction, so two
   * concurrent POST requests could both pass the overlap check and both insert,
   * producing overlapping periods that corrupt timetable generation.
   */
  fastify.post("/v1/periods", {
    preHandler: [authenticateWithTenant, requirePermission("school:config")],
  }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message },
      })
    }
    const { startTime, endTime } = parsed.data
    const schoolId = request.user.schoolId

    try {
      const period = await db.$transaction(async (tx) => {
        // Re-check inside the transaction so the check + insert are atomic.
        const existing = await tx.periodDefinition.findMany({ where: { schoolId } })
        const overlaps = existing.some(
          (p) => startTime < p.endTime && endTime > p.startTime
        )
        if (overlaps) throw new AppError("PERIOD_OVERLAP", "This period overlaps with an existing period", 409)
        return tx.periodDefinition.create({ data: { schoolId, ...parsed.data } })
      })
      return reply.status(201).send({ success: true, data: period })
    } catch (err: any) {
      if (err instanceof AppError) throw err
      if (err.code === "P2002") throw Errors.DUPLICATE("Period number")
      throw err
    }
  })

  /**
   * Delete a period definition (hard delete — no isActive on PeriodDefinition).
   *
   * Fixed C-002: previously called db.periodDefinition.delete({ where: { id } })
   * with no schoolId check. An admin from School A could delete School B's periods.
   */
  fastify.delete("/v1/periods/:id", {
    preHandler: [authenticateWithTenant, requirePermission("school:config")],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await findOwnedPeriodOrThrow(id, request.user.schoolId)
    await db.periodDefinition.delete({ where: { id } })
    return reply.send({ success: true, data: { message: "Period deleted" } })
  })
}