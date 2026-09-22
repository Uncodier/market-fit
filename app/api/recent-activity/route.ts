import { NextRequest, NextResponse } from "next/server"
import { createServiceApiClient } from "@/lib/supabase/server-client"
import { buildRecentActivityFeed } from "./build-feed"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import {
  normalizedRequestCacheKey,
  readThroughJsonCache,
} from "@/lib/redis/json-cache"

export const dynamic = "force-dynamic"

function analyticsAccessRequest(request: Request) {
  const url = new URL(request.url)
  const endValue = url.searchParams.get("endDate")
  const endDate = endValue ? new Date(endValue) : new Date()

  if (!endValue) url.searchParams.set("endDate", endDate.toISOString())
  if (!url.searchParams.has("startDate")) {
    const startDate = new Date(
      (Number.isFinite(endDate.getTime()) ? endDate : new Date()).getTime()
        - 30 * 24 * 60 * 60 * 1000
    )
    url.searchParams.set("startDate", startDate.toISOString())
  }

  return new NextRequest(url, { headers: request.headers })
}

async function getRecentActivity(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const siteId = searchParams.get("siteId")
    const limit = parseInt(searchParams.get("limit") || "6", 10)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    if (!siteId) {
      return NextResponse.json({ error: "Site ID is required" }, { status: 400 })
    }


    const supabase = createServiceApiClient(siteId)
    const activities = await buildRecentActivityFeed(supabase, {
      siteId,
      limit,
      startDate,
      endDate,
    })

    return NextResponse.json({ activities })
  } catch (error) {
    console.error("[recent-activity] Unexpected error:", error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  const scopedRequest = analyticsAccessRequest(request)
  const access = await requireAnalyticsAccess(scopedRequest)
  if (access.error) return access.error

  try {
    const key = await normalizedRequestCacheKey("recent-activity", request)
    const result = await readThroughJsonCache({
      key,
      ttlSeconds: 45,
      compute: async () => {
        const response = await getRecentActivity(scopedRequest)
        if (!response.ok) throw response
        return {
          body: await response.json(),
          headers: Object.fromEntries(response.headers.entries()),
        }
      },
    })

    if (result.status === "busy") {
      return NextResponse.json(
        { error: "Analytics are being refreshed" },
        { status: 503, headers: { "Retry-After": "2" } }
      )
    }

    const headers = new Headers(result.value.headers)
    headers.set("X-Cache", result.status.toUpperCase())
    return NextResponse.json(result.value.body, { headers })
  } catch (error) {
    if (error instanceof Response) return error
    throw error
  }
}
