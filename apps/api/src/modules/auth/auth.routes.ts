import { randomBytes } from "crypto"

import { z } from "zod"
import { type FastifyInstance } from "fastify"
import { hash, argon2id } from "argon2"

import { authenticate } from "../../core/middleware/auth.middleware.js"
import { db } from "../../core/database/prisma.js"
import { redis } from "../../core/redis/client.js"
import { env } from "../../config/env.js"

import { authService } from "./auth.service.js"
 
// ── Shared password schema ────────────────────────────────────────────────────
 
const passwordSchema = z
  .string()
  .min(8,    "Password must be at least 8 characters")
  .regex(/[A-Z]/,        "Must contain an uppercase letter")
  .regex(/[a-z]/,        "Must contain a lowercase letter")
  .regex(/[0-9]/,        "Must contain a number")
  .regex(/[^A-Za-z0-9]/, "Must contain a special character")
 
const registerSchema = z.object({
  schoolName:    z.string().min(2).max(200),
  name:          z.string().min(2).max(100),
  email:         z.string().email("Invalid email address"),
  password:      passwordSchema,
  role:          z.enum(["PRINCIPAL", "ADMINISTRATOR"]).default("PRINCIPAL"),
  schoolAddress: z.string().max(500).optional(),
  schoolPhone:   z.string().max(20).optional(),
  schoolEmail:   z.string().email().optional(),
})
 
const forgotSchema = z.object({
  email: z.string().email("Invalid email address"),
})
 
const resetSchema = z.object({
  token:       z.string().length(64, "Invalid reset token"),
  newPassword: passwordSchema,
})
 
// ── Routes ────────────────────────────────────────────────────────────────────
 
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
 
  // ── Register ────────────────────────────────────────────────────────────────
 
  fastify.post(
    "/v1/auth/register",
    { config: { rateLimit: { max: 3, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code:    "VALIDATION_ERROR",
            message: parsed.error.errors[0].message,
            field:   parsed.error.errors[0].path[0] as string | undefined,
          },
        })
      }
      const result = await authService.register(parsed.data)
      return reply.status(201).send({ success: true, data: result })
    }
  )
 
  // ── Login ───────────────────────────────────────────────────────────────────
 
  fastify.post("/v1/auth/login", async (request, reply) => {
    const { email, password } = request.body as { email?: string; password?: string }
    if (!email || !password) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Email and password are required" },
      })
    }
    const tokens = await authService.login(email, password, request.ip)
    return reply.status(200).send({ success: true, data: tokens })
  })
 
  // ── Refresh ─────────────────────────────────────────────────────────────────
 
  fastify.post("/v1/auth/refresh", async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string }
    if (!refreshToken) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "refreshToken is required" },
      })
    }
    const tokens = await authService.refresh(refreshToken)
    return reply.status(200).send({ success: true, data: tokens })
  })
 
  // ── Logout ──────────────────────────────────────────────────────────────────
 
  fastify.post(
    "/v1/auth/logout",
    { preHandler: authenticate },
    async (request, reply) => {
      const { refreshToken } = request.body as { refreshToken?: string }
      const accessToken = request.headers.authorization!.slice(7)
      await authService.logout(accessToken, refreshToken ?? "")
      return reply.status(200).send({ success: true, data: { message: "Logged out successfully" } })
    }
  )
 
  // ── Me ──────────────────────────────────────────────────────────────────────
 
  fastify.get(
    "/v1/auth/me",
    { preHandler: authenticate },
    async (request, reply) => {
      const user = await db.user.findUnique({
        where:  { id: request.user.userId },
        select: {
          id:                true,
          name:              true,
          email:             true,
          role:              true,
          schoolId:          true,
          preferredLanguage: true,
          lastLoginAt:       true,
          school: { select: { id: true, name: true, subscriptionStatus: true } },
        },
      })
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "User not found" },
        })
      }
      return reply.status(200).send({ success: true, data: user })
    }
  )
 
  // ── Forgot password ─────────────────────────────────────────────────────────
 
  /**
   * POST /v1/auth/forgot-password
   *
   * Always responds 200 regardless of whether the email exists.
   * This prevents user enumeration attacks (attacker can't tell if
   * an email is registered by observing different responses).
   *
   * Token is stored in Redis for 1 hour. If RESEND_API_KEY is
   * configured in env, an email will be sent. Otherwise the reset
   * URL is logged to the server console (useful in development).
   */
  fastify.post(
    "/v1/auth/forgot-password",
    { config: { rateLimit: { max: 3, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const parsed = forgotSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message },
        })
      }
 
      const { email } = parsed.data
 
      // Run async but don't await — always return 200 immediately
      setImmediate(async () => {
        const user = await db.user.findUnique({
          where:  { email },
          select: { id: true, name: true, email: true, isActive: true },
        }).catch(() => null)
 
        if (!user || !user.isActive) return  // Silent — don't reveal if email exists
 
        // 64-char hex token (32 random bytes)
        const token     = randomBytes(32).toString("hex")
        const resetKey  = `pwd_reset:${token}`
        const resetUrl  = `${env.WEB_ADMIN_URL}/reset-password?token=${token}`
 
        await redis.set(resetKey, user.id, "EX", 3600) // 1 hour expiry
 
        // TODO: When Resend is installed (npm install resend in apps/api),
        // replace this block with:
        //   const { Resend } = await import('resend')
        //   const resend = new Resend(process.env.RESEND_API_KEY)
        //   await resend.emails.send({ from: 'EduConnect <noreply@...>', to: email, ... })
        fastify.log.info(
          { email: user.email, resetUrl },
          "[AUTH] Password reset requested — copy this URL to test: " + resetUrl
        )
      })
 
      return reply.status(200).send({
        success: true,
        data: { message: "If that email is registered, a reset link has been sent." },
      })
    }
  )
 
  // ── Reset password ──────────────────────────────────────────────────────────
 
  /**
   * POST /v1/auth/reset-password
   * Validates the one-time Redis token and updates the password.
   * On success: invalidates ALL existing refresh tokens (security —
   * forces re-login on every device after a password reset).
   */
  fastify.post(
    "/v1/auth/reset-password",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const parsed = resetSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message },
        })
      }
 
      const { token, newPassword } = parsed.data
      const resetKey = `pwd_reset:${token}`
 
      const userId = await redis.get(resetKey)
      if (!userId) {
        return reply.status(400).send({
          success: false,
          error: {
            code:    "INVALID_TOKEN",
            message: "Reset token is invalid or has expired. Request a new one.",
          },
        })
      }
 
      const passwordHash = await hash(newPassword, { type: argon2id })
 
      await db.$transaction(async (tx) => {
        await tx.user.update({ where: { id: userId }, data: { passwordHash } })
        // Invalidate all sessions on every device (security best practice)
        await tx.refreshToken.deleteMany({ where: { userId } })
      })
 
      // Delete the one-time token
      await redis.del(resetKey)
 
      return reply.status(200).send({
        success: true,
        data: { message: "Password updated. Please log in with your new password." },
      })
    }
  )
}