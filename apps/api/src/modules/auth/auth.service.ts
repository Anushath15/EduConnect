import { hash as argonHash, verify as argonVerify, argon2id } from "argon2"
import type { UserRole } from "@prisma/client"

import { db } from "../../core/database/prisma.js"
import { redis } from "../../core/redis/client.js"
import { signAccessToken } from "../../utils/jwt.js"
import { generateRefreshToken, hashToken } from "../../utils/crypto.js"
import { Errors, AppError } from "../../core/errors/AppError.js"
 
// ── Shared token-issuance helper ─────────────────────────────────────────────
 
async function issueTokens(userId: string, schoolId: string, role: UserRole) {
  const payload      = { userId, schoolId, role }
  const accessToken  = signAccessToken(payload)
  const refreshToken = generateRefreshToken()
  const tokenHash    = hashToken(refreshToken)
 
  await db.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })
  await redis.set("rt:" + tokenHash, userId, "EX", 604800)
 
  return { accessToken, refreshToken }
}
 
// ── AuthService ───────────────────────────────────────────────────────────────
 
export class AuthService {
 
  /**
   * Register a new school and its first administrator.
   *
   * Creates a School and a User in a single database transaction.
   * If anything fails after the school is created (e.g., duplicate email
   * in a race condition), both records are rolled back — no orphaned schools.
   *
   * Only PRINCIPAL and ADMINISTRATOR roles may self-register.
   * All other staff are added by the school admin via POST /v1/staff.
   */
  async register(input: {
    schoolName:    string
    name:          string
    email:         string
    password:      string
    role:          UserRole
    schoolAddress?: string
    schoolPhone?:   string
    schoolEmail?:   string
  }) {
    // Fast-fail before hashing (Argon2 is intentionally slow).
    const alreadyExists = await db.user.findUnique({ where: { email: input.email } })
    if (alreadyExists) throw Errors.DUPLICATE("Email")
 
    // Hash outside the transaction — holds no DB connection during CPU work.
    const passwordHash = await argonHash(input.password, { type: argon2id })
 
    const { school, user } = await db.$transaction(async (tx) => {
      // Race-condition guard: re-check inside the transaction.
      const raceCheck = await tx.user.findUnique({ where: { email: input.email } })
      if (raceCheck) throw Errors.DUPLICATE("Email")
 
      const school = await tx.school.create({
        data: {
          name:    input.schoolName,
          address: input.schoolAddress,
          phone:   input.schoolPhone,
          email:   input.schoolEmail,
        },
      })
 
      const user = await tx.user.create({
        data: {
          schoolId:     school.id,
          name:         input.name,
          email:        input.email,
          passwordHash,
          role:         input.role,
        },
      })
 
      return { school, user }
    })
 
    const tokens = await issueTokens(user.id, school.id, user.role)
 
    return {
      ...tokens,
      user:   { id: user.id,   name: user.name,   email: user.email,   role: user.role },
      school: { id: school.id, name: school.name },
    }
  }
 
  // ── Login ───────────────────────────────────────────────────────────────────
 
  async login(email: string, password: string, ip: string) {
    const attemptsKey = "login_attempts:" + ip
    const attempts    = await redis.get(attemptsKey)
    if (attempts && parseInt(attempts) >= 5) throw Errors.RATE_LIMITED()
 
    const user = await db.user.findUnique({
      where:  { email },
      select: {
        id:               true,
        email:            true,
        passwordHash:     true,
        role:             true,
        isActive:         true,
        failedLoginCount: true,
        lockedUntil:      true,
        school:           { select: { id: true } },
      },
    })
 
    if (!user || !user.isActive || !user.school) {
      await redis.incr(attemptsKey)
      await redis.expire(attemptsKey, 900)
      throw Errors.UNAUTHORIZED()
    }
 
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError("ACCOUNT_LOCKED", "Account locked. Try again later.", 401)
    }
 
    const valid = await argonVerify(user.passwordHash, password)
    if (!valid) {
      const count = user.failedLoginCount + 1
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: count,
          lockedUntil:      count >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      })
      await redis.incr(attemptsKey)
      await redis.expire(attemptsKey, 900)
      throw Errors.UNAUTHORIZED()
    }
 
    await db.user.update({
      where: { id: user.id },
      data:  { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    })
    await redis.del(attemptsKey)
 
    setImmediate(() => {
      db.auditLog.create({
        data: {
          schoolId:  user.school!.id,
          userId:    user.id,
          action:    "POST /v1/auth/login",
          ipAddress: ip,
        },
      }).catch(() => {})
    })
 
    return issueTokens(user.id, user.school.id, user.role)
  }
 
  // ── Refresh ─────────────────────────────────────────────────────────────────
 
  async refresh(refreshToken: string) {
    const tokenHash = hashToken(refreshToken)
 
    const stored = await db.refreshToken.findUnique({
      where:   { tokenHash },
      include: { user: { select: { id: true, schoolId: true, role: true, isActive: true } } },
    })
 
    if (!stored || stored.expiresAt < new Date() || !stored.user.isActive) {
      throw Errors.UNAUTHORIZED()
    }
 
    await db.refreshToken.delete({ where: { tokenHash } })
    await redis.del("rt:" + tokenHash)
 
    return issueTokens(stored.user.id, stored.user.schoolId, stored.user.role)
  }
 
  // ── Logout ──────────────────────────────────────────────────────────────────
 
  async logout(accessToken: string, refreshToken: string): Promise<void> {
    try {
      const parts   = accessToken.split(".")
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString())
      const ttl     = payload.exp - Math.floor(Date.now() / 1000)
      if (ttl > 0) {
        await redis.set("blacklist:" + accessToken, "1", "EX", ttl)
      }
    } catch { /* malformed token — still clear the refresh */ }
 
    const tokenHash = hashToken(refreshToken)
    await db.refreshToken.deleteMany({ where: { tokenHash } })
    await redis.del("rt:" + tokenHash)
  }
}
 
export const authService = new AuthService()