import { afterAll } from "vitest"

import { db } from "../core/database/prisma.js"
 
afterAll(async () => {
  await db.$disconnect()
})