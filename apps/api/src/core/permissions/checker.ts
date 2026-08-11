import { db } from "../database/prisma.js"
import { redis } from "../redis/client.js"

import { DEFAULT_ROLE_PERMISSIONS } from "./defaults.js"

async function cachePermResult(
  userId: string,
  permission: string,
  value: boolean
): Promise<void> {
  const key = `perm:${userId}:${permission}`
  const setKey = `perm_keys:${userId}`
  await redis
    .multi()
    .setex(key, 300, value ? "1" : "0")
    .sadd(setKey, key)
    .expire(setKey, 300)
    .exec()
}

export async function hasPermission(
  userId: string,
  _schoolId: string,
  permission: string
): Promise<boolean> {
  const cacheKey = `perm:${userId}:${permission}`
  const cached = await redis.get(cacheKey)
  if (cached === "1") return true
  if (cached === "0") return false

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (!user) return false

  const result = DEFAULT_ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false
  await cachePermResult(userId, permission, result)
  return result
}

/**
 * Wipe a user's cached permissions. Call this whenever:
 *   - the user's role changes
 *   - the user is deactivated
 *   - the user's school changes
 *   - an admin manually grants/revokes a permission (future feature)
 *
 * Without this call, a demoted user keeps admin permissions for up to 5 minutes
 * (the cache TTL).
 */
export async function invalidatePermissionCache(userId: string): Promise<void> {
  const setKey = `perm_keys:${userId}`
  const keys = await redis.smembers(setKey)
  if (keys.length > 0) {
    await redis.del(...keys, setKey)
  } else {
    // Cache miss or first invalidation — still clear the index set so a
    // re-promoted user doesn't inherit stale entries from a different role.
    await redis.del(setKey)
  }
}

/**
 * Invalidate all users in a school. Call after admin changes the school's
 * permission policy (future feature).
 */
export async function invalidateSchoolPermissionCache(schoolId: string): Promise<void> {
  // SCAN is cheap enough for tens of thousands of keys.
  let cursor = "0"
  do {
    const [next, batch] = await redis.scan(cursor, "MATCH", `perm_keys:*`, "COUNT", 200)
    cursor = next
    if (batch.length === 0) continue
    const userIds = batch.map((k) => k.replace(/^perm_keys:/, ""))
    const users = await db.user.findMany({
      where: { id: { in: userIds }, schoolId },
      select: { id: true },
    })
    await Promise.all(users.map((u) => invalidatePermissionCache(u.id)))
  } while (cursor !== "0")
}
