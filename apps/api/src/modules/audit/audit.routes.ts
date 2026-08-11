import { FastifyInstance } from "fastify"

import { authenticateWithTenant } from "../../core/middleware/tenant.middleware.js"
import { requirePermission }      from "../../core/middleware/rbac.middleware.js"

import { auditService } from "./audit.service.js"

export async function auditRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /v1/audit-logs
   *
   * Returns a paginated list of audit log entries for the authenticated school.
   * Only accessible to users with the `audit:view` permission.
   *
   * Query params:
   *   page      (default 1)
   *   limit     (default 20, max 100)
   *   startDate (ISO 8601 date string, optional)
   *   endDate   (ISO 8601 date string, optional)
   */
  fastify.get(
    "/v1/audit-logs",
    { preHandler: [authenticateWithTenant, requirePermission("audit:view")] },
    async (request, reply) => {
      const q = request.query as {
        page?: string
        limit?: string
        startDate?: string
        endDate?: string
      }

      const page  = Math.max(1, parseInt(q.page  ?? "1",  10) || 1)
      const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? "20", 10) || 20))
      const startDate = q.startDate ? new Date(q.startDate) : undefined
      const endDate   = q.endDate   ? new Date(q.endDate)   : undefined

      const result = await auditService.getLogs(
        request.user.schoolId,
        page,
        limit,
        startDate,
        endDate
      )

      return reply.status(200).send({ success: true, data: result.logs, meta: result.meta })
    }
  )
}
