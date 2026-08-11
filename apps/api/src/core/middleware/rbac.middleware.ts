import { FastifyRequest, FastifyReply } from "fastify"

import { hasPermission } from "../permissions/checker.js"
import { Errors } from "../errors/AppError.js"
 
/**
 * Factory that returns a Fastify preHandler enforcing a single permission string.
 * The permission string must exist in DEFAULT_ROLE_PERMISSIONS for the user's role.
 *
 * Fixed C-001: previously threw Errors.FORBIDDEN (a function ref), which caused
 * the Fastify error handler to treat every permission denial as an unhandled error
 * and return HTTP 500 instead of 403.
 */
export function requirePermission(permission: string) {
  return async function (
    request: FastifyRequest,
    _reply: FastifyReply
  ): Promise<void> {
    const allowed = await hasPermission(
      request.user.userId,
      request.user.schoolId,
      permission
    )
    if (!allowed) throw Errors.FORBIDDEN()
  }
}