import dotenv from "dotenv"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
const __filename = fileURLToPath(import.meta.url)
const __rootDir = resolve(dirname(__filename), "../../../")
dotenv.config({ path: resolve(__rootDir, ".env") })

import { buildApp } from "./app.js"
import { env } from "./config/env.js"

async function start() {
  const fastify = await buildApp()

  await fastify.listen({
    port: env.PORT,
    host: "0.0.0.0",
  })

  process.on("SIGTERM", async () => {
    fastify.log.info("SIGTERM received - shutting down")
    await fastify.close()
    process.exit(0)
  })

  process.on("SIGINT", async () => {
    fastify.log.info("SIGINT received - shutting down")
    await fastify.close()
    process.exit(0)
  })
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
