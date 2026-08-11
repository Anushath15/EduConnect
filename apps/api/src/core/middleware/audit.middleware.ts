import { FastifyRequest, FastifyReply } from "fastify"

import { db } from "../database/prisma.js"

// Routes that already self-log — skip to avoid duplicate audit entries.
const SKIP_PREFIXES = ["/v1/auth/", "/health"]

// Only log mutating methods; GET/HEAD/OPTIONS produce no side effects.
const LOG_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

// A segment is treated as an ID if it looks like a UUID or a sufficiently
// long opaque alphanumeric token. Single-character segments are skipped so
// that action keywords like "respond", "cancel", "teacher" don't get
// mistaken for IDs.
const ID_LIKE_RE = /^[a-zA-Z0-9_-]{8,}$/

// Endpoints whose second segment is an action keyword rather than an ID.
const ACTION_KEYWORDS = new Set([
  "me", "login", "logout", "refresh", "register", "forgot-password", "reset-password",
  "assign", "respond", "cancel", "generate", "assign-subject", "assignments",
  "mark-absent", "available-teachers", "bulk", "bulk-import",
])

/**
 * Extracts a human-readable entity type from a URL path.
 * `/v1/teachers/abc-123`        → "teachers"
 * `/v1/substitutions/abc/respond` → "substitutions"
 */
function extractEntityType(url: string): string {
  const path    = url.split("?")[0]
  const cleaned = path.replace(/^\/(api\/)?v\d\//, "")
  return cleaned.split("/")[0] ?? "unknown"
}

/**
 * Extracts entityId from the URL if the second segment looks like an ID
 * (UUID-shaped, or a sufficiently long opaque alphanumeric token).
 *
 * `/v1/students/abc-123`     → "abc-123"
 * `/v1/substitutions/abc/respond` → "abc"  (third segment is the action)
 * `/v1/timetable/generate`   → undefined  (action keyword)
 */
function extractEntityId(url: string): string | undefined {
  const path    = url.split("?")[0]
  const cleaned = path.replace(/^\/(api\/)?v\d\//, "")
  const parts   = cleaned.split("/")
  if (parts.length < 2) return undefined
  const candidate = parts[1]
  if (!candidate) return undefined
  if (ACTION_KEYWORDS.has(candidate.toLowerCase())) return undefined
  if (!ID_LIKE_RE.test(candidate)) return undefined
  return candidate
}

/**
 * Fastify onResponse hook that writes an AuditLog entry for every
 * successful mutating request. Fires asynchronously via setImmediate
 * so it never adds latency to the response.
 */
export async function auditHook(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const method = request.method.toUpperCase()
  const url    = request.url

  if (!LOG_METHODS.has(method)) return
  if (SKIP_PREFIXES.some((p) => url.includes(p))) return

  const user = (request as any).user
  if (!user?.userId || !user?.schoolId) return

  const entityType = extractEntityType(url)
  const entityId   = extractEntityId(url)
  const action     = `${method} ${url.split("?")[0]}`

  setImmediate(() => {
    db.auditLog
      .create({
        data: {
          schoolId:   user.schoolId,
          userId:     user.userId,
          action,
          entityType,
          entityId,
          ipAddress:  request.ip,
        },
      })
      .catch(() => {
        // Intentionally swallowed — audit failure must never break business flow.
      })
  })
}
