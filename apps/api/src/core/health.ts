import { FastifyInstance } from "fastify"

import { db } from "./database/prisma.js"
import { redis } from "./redis/client.js"

/**
 * Health check with real DB + Redis pings. Returns 503 if either is unhealthy.
 * Registered at /health with no auth required.
 */
export async function healthCheck(fastify: FastifyInstance): Promise<void> {
  fastify.get("/health", async (_request, reply) => {
    const checks = {
      database: false,
      redis:    false,
      timestamp: new Date().toISOString(),
      uptime:    process.uptime(),
    }

    try {
      await db.$queryRaw`SELECT 1`
      checks.database = true
    } catch (err: any) {
      fastify.log.error({ err: err?.message }, "Database health check failed")
    }

    try {
      const pong = await redis.ping()
      checks.redis = pong === "PONG"
    } catch (err: any) {
      fastify.log.error({ err: err?.message }, "Redis health check failed")
    }

    const status = checks.database && checks.redis ? 200 : 503
    return reply.status(status).send({
      status: status === 200 ? "healthy" : "unhealthy",
      checks,
    })
  })
}
