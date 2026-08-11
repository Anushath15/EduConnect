import Fastify, { type FastifyInstance } from "fastify"
import helmet    from "@fastify/helmet"
import cors      from "@fastify/cors"
import cookie    from "@fastify/cookie"
import multipart from "@fastify/multipart"
import rateLimit from "@fastify/rate-limit"

import { env }      from "./config/env.js"
import { AppError } from "./core/errors/AppError.js"
import { healthCheck } from "./core/health.js"
import { swaggerPlugin }       from "./core/swagger.js"
import { authRoutes }          from "./modules/auth/auth.routes.js"
import { staffRoutes }         from "./modules/staff/staff.routes.js"
import { schoolRoutes }        from "./modules/school/school.routes.js"
import { classesRoutes }       from "./modules/classes/classes.routes.js"
import { subjectsRoutes }      from "./modules/subjects/subjects.routes.js"
import { periodsRoutes }       from "./modules/periods/periods.routes.js"
import { teachersRoutes }      from "./modules/teachers/teachers.routes.js"
import { studentsRoutes }      from "./modules/students/students.routes.js"
import { timetableRoutes }     from "./modules/timetable/timetable.routes.js"
import { substitutionRoutes }  from "./modules/substitution/substitution.routes.js"
import { swapRoutes }          from "./modules/swap/swap.routes.js"
import { announcementsRoutes } from "./modules/announcements/announcements.routes.js"
import { resourceRoutes }      from "./modules/resources/resource.routes.js"
import { attendanceRoutes }    from "./modules/attendance/attendance.routes.js"
import { auditRoutes }         from "./modules/audit/audit.routes.js"
import { auditHook }           from "./core/middleware/audit.middleware.js"

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: env.NODE_ENV === "development"
      ? { transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } } }
      : true,
  })

  await fastify.register(swaggerPlugin)
  await fastify.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV !== "development",
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
  await fastify.register(cors, {
    origin: (origin, cb) => {
      const allowed = [env.FRONTEND_URL, env.WEB_ADMIN_URL]
      // Allow same-origin / curl (no origin) and localhost in development.
      if (!origin) return cb(null, true)
      if (env.NODE_ENV === "development" && /^http:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true)
      if (allowed.includes(origin)) return cb(null, true)
      cb(new Error(`CORS: origin ${origin} not allowed`), false)
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
  await fastify.register(cookie, {
    secret: env.COOKIE_SECRET ?? env.JWT_ACCESS_SECRET,
  })
  await fastify.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } })
  await fastify.register(rateLimit, {
    max: env.NODE_ENV === "development" ? 1000 : 100,
    timeWindow: "1 minute",
    keyGenerator: (req) => (req as any).user?.userId ?? req.ip ?? "unknown",
    errorResponseBuilder: (_req, context) => ({
      success: false,
      error: { code: "RATE_LIMIT", message: `Too many requests. Retry after ${context.after}` },
    }),
  })

  fastify.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message, field: error.field },
      })
    }
    if ((error as any).validation) {
      // Fastify schema-validation errors
      return reply.status(400).send({
        success: false,
        error: {
          code:    "VALIDATION_ERROR",
          message: (error as any).message,
          field:   (error as any).validation?.[0]?.instancePath?.replace(/^\//, ""),
        },
      })
    }
    fastify.log.error({ err: error }, "Unhandled error")
    return reply.status(500).send({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    })
  })

  await healthCheck(fastify)

  // Routes use full paths (/v1/auth/login, /v1/classes, …)
  await fastify.register(authRoutes)
  await fastify.register(staffRoutes)
  await fastify.register(schoolRoutes)
  await fastify.register(classesRoutes)
  await fastify.register(subjectsRoutes)
  await fastify.register(periodsRoutes)
  await fastify.register(teachersRoutes)
  await fastify.register(studentsRoutes)
  await fastify.register(timetableRoutes)
  await fastify.register(substitutionRoutes)
  await fastify.register(swapRoutes)
  await fastify.register(announcementsRoutes)
  await fastify.register(resourceRoutes)
  await fastify.register(attendanceRoutes)
  await fastify.register(auditRoutes)

  fastify.addHook("onResponse", auditHook)

  return fastify
}
