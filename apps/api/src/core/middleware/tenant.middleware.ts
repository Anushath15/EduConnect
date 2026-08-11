import { FastifyRequest, FastifyReply } from "fastify"

import { db } from "../database/prisma.js"
import { Errors } from "../errors/AppError.js"

import { authenticate } from "./auth.middleware.js"

export async function authenticateWithTenant(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await authenticate(request, reply)

  const user = await db.user.findUnique({
    where: { id: request.user.userId, isActive: true },
    select: { id: true, schoolId: true, role: true },
  })

  if (!user) {
    throw Errors.UNAUTHORIZED()
  }

  if (user.schoolId !== request.user.schoolId) {
    throw Errors.FORBIDDEN()
  }
}
