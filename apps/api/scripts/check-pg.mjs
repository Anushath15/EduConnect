import { config } from "dotenv"
config({ path: "../../.env" })

import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()
try {
  await db.$queryRaw`SELECT 1 as ok`
  console.log("PG CONNECT OK")
} catch (e) {
  console.log("PG FAIL:", e.message)
}
await db.$disconnect()
