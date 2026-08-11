import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { config as dotenvConfig } from "dotenv"

import { buildApp } from "./app.js"
import { env } from "./config/env.js"

const __filename = fileURLToPath(import.meta.url)
const __rootDir  = resolve(dirname(__filename), "../../../")
dotenvConfig({ path: resolve(__rootDir, ".env") })

async function start(): Promise<void> {
  const fastify = await buildApp()

  await fastify.listen({
    port: env.PORT,
    host: "0.0.0.0",
  })

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, async () => {
      fastify.log.info(`${signal} received — shutting down`)
      await fastify.close()
      process.exit(0)
    })
  }
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
