import { PrismaClient } from "@prisma/client"

import { env } from "../../config/env.js"

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

export const db = global.__prisma ?? new PrismaClient({
  log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
})

if (env.NODE_ENV !== "production") global.__prisma = db

process.on("SIGTERM", async () => {
  await db.$disconnect().catch(() => {})
})

process.on("SIGINT", async () => {
  await db.$disconnect().catch(() => {})
})
