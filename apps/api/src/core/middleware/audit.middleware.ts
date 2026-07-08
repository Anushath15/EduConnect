import { FastifyRequest, FastifyReply } from "fastify"
import { db } from "../database/prisma.js"

// Routes that already self-log — skip to avoid duplicate audit entries
const SKIP_PREFIXES = ["/v1/auth/", "/health"]

// Only log mutating methods; GET/HEAD/OPTIONS produce no side effects
const LOG_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

/**
 * Extracts a human-readable entity type from a URL path.
 * E.g. "/api/v1/teachers/abc123" → "teachers"
 *      "/v1/substitutions/abc/respond" → "substitutions"
 */
function extractEntityType(url: string): string {
  // Strip query string
  const path    = url.split("?")[0]
  // Strip /api/v1/ or /v1/ prefix
  const cleaned = path.replace(/^\/(api\/)?v\d\//, "")
  // First path segment = entity type
  return cleaned.split("/")[0] ?? "unknown"
}

/**
 * Extracts entityId from the URL if the second segment looks like a UUID or
 * non-keyword token (e.g. /v1/teachers/abc-123 → "abc-123")
 */
function extractEntityId(url: string): string | undefined {
  const path    = url.split("?")[0]
  const cleaned = path.replace(/^\/(api\/)?v\d\//, "")
  const parts   = cleaned.split("/")
  // parts[0] = entity, parts[1] = id (if present and not a sub-action keyword)
  if (parts.length >= 2 && parts[1] && !parts[1].includes("-") === false) {
    // Treat as id if it contains a hyphen (UUID) or is purely alphanumeric
    const candidate = parts[1]
    if (/^[a-zA-Z0-9_-]{5,}$/.test(candidate)) return candidate
  }
  return undefined
}

/**
 * Fastify onResponse hook that writes an AuditLog entry for every
 * successful mutating request.  Fires asynchronously via setImmediate
 * so it never adds latency to the response.
 */
export async function auditHook(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const method = request.method.toUpperCase()
  const url    = request.url

  // Only log mutations on authenticated routes
  if (!LOG_METHODS.has(method)) return
  if (SKIP_PREFIXES.some((p) => url.includes(p))) return

  // User must be authenticated for us to attribute the action
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
        // Intentionally swallowed — audit failure must never break business flow
      })
  })
}
