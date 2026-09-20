import { NextResponse } from "next/server"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import {
  checkRateLimit,
  hashRedisKeyPart,
  rateLimitError,
} from "@/lib/redis/control-plane"

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_MAX_RANGE_DAYS = 93
const internallyAuthorizedRequests = new WeakMap<Request, string>()

export function markAnalyticsRequestAuthorized(
  request: Request,
  userId: string
): void {
  internallyAuthorizedRequests.set(request, userId)
}

function configuredMaxRangeDays(): number {
  const value = Number(process.env.ANALYTICS_MAX_RANGE_DAYS)
  return Number.isSafeInteger(value) && value > 0
    ? value
    : DEFAULT_MAX_RANGE_DAYS
}

type AnalyticsAccessResult =
  | { error: NextResponse }
  | {
      error?: undefined
      siteId: string
      startDate: Date
      endDate: Date
      userId: string
    }

export async function requireAnalyticsAccess(
  request: Request
): Promise<AnalyticsAccessResult> {
  const { searchParams } = new URL(request.url)
  const siteId = searchParams.get("siteId")
  const startDateValue = searchParams.get("startDate")
  const endDateValue = searchParams.get("endDate")

  if (!siteId || !startDateValue || !endDateValue) {
    return {
      error: NextResponse.json(
        { error: "Site ID and date range are required" },
        { status: 400 }
      ),
    }
  }

  const startDate = new Date(startDateValue)
  const endDate = new Date(endDateValue)
  const rangeMs = endDate.getTime() - startDate.getTime()

  if (
    !Number.isFinite(startDate.getTime()) ||
    !Number.isFinite(endDate.getTime()) ||
    rangeMs < 0
  ) {
    return {
      error: NextResponse.json(
        { error: "Invalid date range" },
        { status: 400 }
      ),
    }
  }

  if (rangeMs > configuredMaxRangeDays() * DAY_MS) {
    return {
      error: NextResponse.json(
        {
          error: `Date range cannot exceed ${configuredMaxRangeDays()} days`,
        },
        { status: 400 }
      ),
    }
  }

  const internalUserId = internallyAuthorizedRequests.get(request)
  if (internalUserId) {
    return { siteId, startDate, endDate, userId: internalUserId }
  }

  const access = await requireSiteAccess(request, siteId)
  if (access.error) {
    return { error: access.error }
  }

  const failureMode =
    process.env.REDIS_REQUIRED === "true" ? "closed" : "open"
  const [userHash, siteHash] = await Promise.all([
    hashRedisKeyPart(access.userId),
    hashRedisKeyPart(siteId),
  ])
  const userLimit = await checkRateLimit(`rl:v1:analytics:user:${userHash}`, {
    limit: 20,
    windowSeconds: 60,
    failureMode,
  })
  if (!userLimit.allowed) return { error: rateLimitError(userLimit) }

  const siteLimit = await checkRateLimit(`rl:v1:analytics:site:${siteHash}`, {
    limit: 60,
    windowSeconds: 60,
    failureMode,
  })
  if (!siteLimit.allowed) return { error: rateLimitError(siteLimit) }

  return { siteId, startDate, endDate, userId: access.userId }
}
