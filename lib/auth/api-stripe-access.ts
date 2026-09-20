import { requireSiteAccess } from "@/lib/auth/api-site-access"
import {
  checkRateLimit,
  hashRedisKeyPart,
  rateLimitError,
} from "@/lib/redis/control-plane"

export async function requireStripeSiteAccess(
  request: Request,
  siteId: string
): Promise<Awaited<ReturnType<typeof requireSiteAccess>>> {
  const access = await requireSiteAccess(request, siteId, {
    requireManager: true,
  })
  if (access.error) return access

  const failureMode =
    process.env.REDIS_REQUIRED === "true" ? "closed" : "open"
  const operation = new URL(request.url).pathname.replace(
    /^\/api\/stripe\//,
    ""
  )
  const [userHash, siteHash] = await Promise.all([
    hashRedisKeyPart(access.userId),
    hashRedisKeyPart(siteId),
  ])
  const policy = { limit: 5, windowSeconds: 300, failureMode } as const

  const userLimit = await checkRateLimit(
    `rl:v1:stripe:${operation}:user:${userHash}`,
    policy
  )
  if (!userLimit.allowed) return { error: rateLimitError(userLimit) }

  const siteLimit = await checkRateLimit(
    `rl:v1:stripe:${operation}:site:${siteHash}`,
    policy
  )
  if (!siteLimit.allowed) return { error: rateLimitError(siteLimit) }

  return access
}
