import { config as dotenvConfig } from "dotenv"
import { z } from "zod"

dotenvConfig()

/**
 * Strict environment validation. Runs at module load and aborts the process
 * with a clear error if anything is wrong. This is a security control: a
 * misconfigured secret MUST crash the server, never silently default.
 */

// ── Secret-quality guard ──────────────────────────────────────────────────────
// Reject known-bad values (placeholder literals, the literal word "password",
// short values, all-digit, all-same-character). These are the strings most
// commonly left behind by accident during scaffolding / copy-paste /
// docker-compose dev defaults. Catching them at startup prevents deploying
// an app that boots but is trivially exploitable.
const SECRET_LITERALS_TO_FORBID = [
  "password",
  "replace-me",
  "replace-with-at-least-32-characters-of-randomness",
  "REPLACE_WITH_64_CHAR_RANDOM_STRING",
  "your_very_long_and_secure_access_secret_here",
  "your_very_long_and_secure_refresh_secret_here",
  "change-me",
  "changeme",
  "secret",
  "12345678",
  "12345678901234567890",
  "test-access-secret-64-char-long-string-here-12345678901234567890",
  "test-refresh-secret-64-char-long-string-here-12345678901234567890",
  "educonnect_dev_2024",
  "a_very_long_random_string_at_least_32_chars_long",
  "another_very_long_random_string_at_least_32_chars_long",
] as const

function strongSecret(label: string, minLen = 32) {
  return z
    .string()
    .min(minLen, `${label} must be at least ${minLen} characters`)
    .refine(
      (v) => !SECRET_LITERALS_TO_FORBID.includes(v as any),
      { message: `${label} is set to a known-bad placeholder literal — rotate it` }
    )
    .refine(
      (v) => {
        // Reject trivially low entropy: all-same-char, all-digit, monotonic run.
        if (/^(.)\1+$/.test(v)) return false
        if (/^\d+$/.test(v)) return false
        if (/^(0123456789|abcdefghijklmnopqrstuvwxyz)+$/i.test(v)) return false
        return true
      },
      { message: `${label} has trivially low entropy — use a random generator` }
    )
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  DATABASE_URL: z
    .string()
    .min(1)
    .refine(
      (v) => v.startsWith("postgres://") || v.startsWith("postgresql://"),
      "DATABASE_URL must be a postgres:// or postgresql:// URL"
    )
    .refine(
      (v) => !/postgres:\/\/[^:]*:password@/.test(v),
      "DATABASE_URL contains the placeholder password 'password' — set a real one"
    ),

  REDIS_URL: z
    .string()
    .min(1)
    .refine((v) => v.startsWith("redis://") || v.startsWith("rediss://"), {
      message: "REDIS_URL must be a redis:// or rediss:// URL",
    })
    .refine((v) => !v.includes(":@"), {
      message: "REDIS_URL contains empty password (':@') — set a real one or remove the colon",
    }),

  JWT_ACCESS_SECRET: strongSecret("JWT_ACCESS_SECRET", 32),
  JWT_REFRESH_SECRET: strongSecret("JWT_REFRESH_SECRET", 32),

  COOKIE_SECRET: strongSecret("COOKIE_SECRET", 32).optional(),

  JWT_ACCESS_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/).default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/).default("7d"),

  FRONTEND_URL: z.string().url().default("http://localhost:8081"),
  WEB_ADMIN_URL: z.string().url().default("http://localhost:3001"),

  // ── Optional integrations — only validated when present ──────────────────
  CLOUDINARY_URL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error("\n\u274c  Invalid environment variables:\n")
  for (const [field, issues] of Object.entries(parsed.error.flatten().fieldErrors)) {
    for (const issue of issues ?? []) {
      console.error(`   ${field.padEnd(28)} \u2192 ${issue}`)
    }
  }
  console.error("\nFix the .env file (see .env.example for the template).\n")
  process.exit(1)
}

export const env = parsed.data

// ── Production hardening ──────────────────────────────────────────────────────
// In production, refuse to boot if integration secrets are obviously placeholders.
if (env.NODE_ENV === "production") {
  const placeholders = [
    ["CLOUDINARY_URL", env.CLOUDINARY_URL, ["cloudinary://replace-me", "cloudinary://api_key:api_secret@cloud_name"]],
    ["RESEND_API_KEY", env.RESEND_API_KEY, ["replace-me", "re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"]],
  ] as const

  for (const [name, value, bad] of placeholders) {
    if (value && (bad as readonly string[]).some((b) => value.includes(b))) {
      console.error(`\n\u274c  ${name} is set to a placeholder literal in production. Refusing to boot.\n`)
      process.exit(1)
    }
  }
}
