import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"
import type { FastifyInstance } from "fastify"

import { buildApp } from "../app.js"
import { db }       from "../core/database/prisma.js"
 
let app: FastifyInstance
 
beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})
 
afterAll(async () => {
  await app.close()
})
 
// Clean state before each test — delete in FK-safe order
beforeEach(async () => {
  await db.refreshToken.deleteMany()
  await db.auditLog.deleteMany()
  await db.user.deleteMany()
  await db.school.deleteMany()
})
 
// ── Register ──────────────────────────────────────────────────────────────────
 
describe("POST /v1/auth/register", () => {
 
  it("creates a school and admin, returns 201 with tokens", async () => {
    const res = await app.inject({
      method:  "POST",
      url:     "/v1/auth/register",
      payload: {
        schoolName: "Test School",
        name:       "Principal Admin",
        email:      "admin@testschool.com",
        password:   "SecurePass123!",
        role:       "PRINCIPAL",
      },
    })
 
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.payload)
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty("accessToken")
    expect(body.data).toHaveProperty("refreshToken")
    expect(body.data.user.email).toBe("admin@testschool.com")
    expect(body.data.user.role).toBe("PRINCIPAL")
    expect(body.data.school.name).toBe("Test School")
  })
 
  it("returns 409 when email is already registered", async () => {
    const payload = {
      schoolName: "School One",
      name:       "Admin",
      email:      "dup@test.com",
      password:   "SecurePass123!",
      role:       "PRINCIPAL",
    }
    // First registration — should succeed
    await app.inject({ method: "POST", url: "/v1/auth/register", payload })
 
    // Second registration with same email — should conflict
    const res = await app.inject({
      method:  "POST",
      url:     "/v1/auth/register",
      payload: { ...payload, schoolName: "School Two" },
    })
 
    expect(res.statusCode).toBe(409)
    const body = JSON.parse(res.payload)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe("DUPLICATE")
  })
 
  it("returns 400 when password does not meet complexity requirements", async () => {
    const res = await app.inject({
      method:  "POST",
      url:     "/v1/auth/register",
      payload: {
        schoolName: "Test School",
        name:       "Admin",
        email:      "admin@test.com",
        password:   "weak",        // too short, no uppercase, no number, no special char
        role:       "PRINCIPAL",
      },
    })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.payload)
    expect(body.error.code).toBe("VALIDATION_ERROR")
  })
 
  it("returns 400 when role is not PRINCIPAL or ADMINISTRATOR", async () => {
    const res = await app.inject({
      method:  "POST",
      url:     "/v1/auth/register",
      payload: {
        schoolName: "Test School",
        name:       "Teacher",
        email:      "teacher@test.com",
        password:   "SecurePass123!",
        role:       "CLASS_TEACHER",   // not allowed via self-registration
      },
    })
    expect(res.statusCode).toBe(400)
  })
 
})
 
// ── Login ─────────────────────────────────────────────────────────────────────
 
describe("POST /v1/auth/login", () => {
 
  it("returns 200 with tokens for valid credentials", async () => {
    // Register first
    await app.inject({
      method:  "POST",
      url:     "/v1/auth/register",
      payload: {
        schoolName: "Login Test School",
        name:       "Admin",
        email:      "login@test.com",
        password:   "SecurePass123!",
        role:       "PRINCIPAL",
      },
    })
 
    // Then login
    const res = await app.inject({
      method:  "POST",
      url:     "/v1/auth/login",
      payload: { email: "login@test.com", password: "SecurePass123!" },
    })
 
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty("accessToken")
    expect(body.data).toHaveProperty("refreshToken")
  })
 
  it("returns 401 for wrong password", async () => {
    await app.inject({
      method:  "POST",
      url:     "/v1/auth/register",
      payload: {
        schoolName: "Test",
        name:       "Admin",
        email:      "wrong@test.com",
        password:   "SecurePass123!",
        role:       "PRINCIPAL",
      },
    })
 
    const res = await app.inject({
      method:  "POST",
      url:     "/v1/auth/login",
      payload: { email: "wrong@test.com", password: "WrongPassword99!" },
    })
 
    expect(res.statusCode).toBe(401)
  })
 
})