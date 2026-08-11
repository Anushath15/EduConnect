import { z } from "zod"
import { FastifyRequest, FastifyReply } from "fastify"

import { verifyAccessToken } from "../../utils/jwt.js"
import { redis } from "../redis/client.js"
import { Errors } from "../errors/AppError.js"

// Strict shape check on the JWT payload. Without this, a token signed with
// the correct secret could contain ANY field (or no fields at all) and the
// middleware would still attach it to the request. Defence-in-depth against
// forged tokens and accidental over-issuance.
const JwtPayloadSchema = z.object({
  userId:   z.string().uuid(),
  schoolId: z.string().uuid(),
  role:     z.enum([
    "PRINCIPAL", "VICE_PRINCIPAL", "COORDINATOR", "ADMINISTRATOR",
    "CLASS_TEACHER", "SUBJECT_TEACHER", "TEMP_TEACHER", "INTERN", "OFFICE_STAFF",
  ]),
  iat: z.number().int().optional(),
  exp: z.number().int().optional(),
})

export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    throw Errors.UNAUTHORIZED()
  }

  const token = authHeader.slice(7)
  if (!token) {
    throw Errors.UNAUTHORIZED()
  }

  const rawPayload = verifyAccessToken(token)
  if (!rawPayload) {
    throw Errors.UNAUTHORIZED()
  }

  const parsed = JwtPayloadSchema.safeParse(rawPayload)
  if (!parsed.success) {
    throw Errors.UNAUTHORIZED()
  }

  const blacklisted = await redis.get(`blacklist:${token}`)
  if (blacklisted) {
    throw Errors.UNAUTHORIZED()
  }

  request.user = parsed.data
}
