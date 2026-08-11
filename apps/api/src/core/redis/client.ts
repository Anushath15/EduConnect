import { Redis } from "ioredis"

import { env } from "../../config/env.js"

export const redis = new Redis(env.REDIS_URL, {
  retryStrategy(times: number) {
    if (times > 10) return null
    return Math.min(times * 100, 3000)
  },
  maxRetriesPerRequest: 3,
  lazyConnect: false,
})

redis.on("error", (err: Error) => {
  // Don't crash the process on transient Redis errors; the API will surface
  // them at request time via the auth/permission middleware.
  if ((err as any).code !== "ECONNREFUSED") {
    // eslint-disable-next-line no-console
    console.error("Redis error: " + err.message)
  }
})
