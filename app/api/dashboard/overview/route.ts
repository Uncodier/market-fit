import { NextRequest, NextResponse } from "next/server"
import { GET as revenue } from "@/app/api/revenue/route"
import { GET as ltv } from "@/app/api/ltv/route"
import { GET as cac } from "@/app/api/cac/route"
import { GET as cpl } from "@/app/api/cpl/route"
import { GET as roi } from "@/app/api/roi/route"
import { GET as activeUsers } from "@/app/api/active-users/route"
import { GET as activeSegments } from "@/app/api/active-segments/route"
import { GET as activeCampaigns } from "@/app/api/active-campaigns/route"
import {
  markAnalyticsRequestAuthorized,
  requireAnalyticsAccess,
} from "@/lib/auth/api-analytics-access"
import {
  normalizedRequestCacheKey,
  readThroughJsonCache,
} from "@/lib/redis/json-cache"

type Handler = (request: NextRequest) => Promise<Response>

const HANDLERS: Record<string, Handler> = {
  revenue,
  ltv,
  cac,
  cpl,
  roi,
  "active-users": activeUsers,
  "active-segments": activeSegments,
  "active-campaigns": activeCampaigns,
}

async function readHandler(
  handler: Handler,
  request: NextRequest,
  path: string,
  userId: string
) {
  const url = new URL(request.url)
  url.pathname = `/api/${path}`
  try {
    const childRequest = new NextRequest(url, { headers: request.headers })
    markAnalyticsRequestAuthorized(childRequest, userId)
    const response = await handler(childRequest)
    return await response.json()
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to load" }
  }
}

export async function GET(request: NextRequest) {
  const access = await requireAnalyticsAccess(request)
  if (access.error) return access.error

  const cacheKey = await normalizedRequestCacheKey("dashboard-overview", request)
  const result = await readThroughJsonCache({
    key: cacheKey,
    ttlSeconds: 60,
    lockTtlMs: 60_000,
    compute: async () => {
      const entries = await Promise.all(
        Object.entries(HANDLERS).map(async ([key, handler]) => [
          key,
          await readHandler(handler, request, key, access.userId),
        ])
      )
      return Object.fromEntries(entries)
    },
  })

  if (result.status === "busy") {
    return NextResponse.json(
      { error: "Analytics are being refreshed" },
      { status: 503, headers: { "Retry-After": "2" } }
    )
  }
  return NextResponse.json(result.value, {
    headers: { "X-Cache": result.status.toUpperCase() },
  })
}
