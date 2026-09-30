import { NextRequest, NextResponse } from "next/server"
import { markAnalyticsRequestAuthorized } from "@/lib/auth/api-analytics-access"
import { normalizedRequestCacheKey, readThroughJsonCache } from "@/lib/redis/json-cache"
import { isMetricPayload, isReportBatch, reportCurrencyOptions, reportMetricKeys, type ReportBatchKind } from "./report-groups"

type Handler = (request: NextRequest) => Promise<Response>
const NO_STORE = { "Cache-Control": "private, no-store" }

class MetricFailure extends Error {
  constructor(readonly status: number, readonly retryAfter: string | null = null, readonly availableCurrencies?: string[]) {
    super("Metric unavailable")
  }
}

async function readMetric(
  request: NextRequest,
  kind: ReportBatchKind,
  key: string,
  handler: Handler,
  userId: string
) {
  const url = new URL(request.url)
  url.pathname = kind === "performance" ? `/api/performance/${key}` : `/api/${key}`
  // Group selection belongs to the batch, not to the direct metric cache key.
  url.searchParams.delete("group")
  url.searchParams.delete("userId")
  if (kind === "overview" && key === "revenue") url.searchParams.set("includeCategories", "false")
  const childRequest = new NextRequest(url, { headers: request.headers })
  markAnalyticsRequestAuthorized(childRequest, userId)
  const response = await handler(childRequest)
  if (!response.ok) {
    if (kind === "overview" && key === "revenue" && response.status === 422) {
      const body: unknown = await response.json()
      const currencies = body && typeof body === "object" && "availableCurrencies" in body
        ? reportCurrencyOptions(body.availableCurrencies) : undefined
      if (currencies) throw new MetricFailure(422, null, currencies)
    }
    const status = [400, 401, 403, 429, 503].includes(response.status) ? response.status : 502
    throw new MetricFailure(status, response.headers.get("Retry-After"))
  }
  const value: unknown = await response.json()
  if (!isMetricPayload(value)) throw new MetricFailure(502)
  return [key, value] as const
}

// Call only after the route's own requireAnalyticsAccess check.
export async function dashboardBatchResponse(options: {
  request: NextRequest
  kind: ReportBatchKind
  handlers: Record<string, Handler>
  userId: string
}) {
  const { request, kind, handlers, userId } = options
  const groups = request.nextUrl.searchParams.getAll("group")
  const keys = reportMetricKeys(kind, groups[0])
  if (groups.length > 1 || keys === null) {
    return NextResponse.json({ error: "Invalid report group" }, { status: 400, headers: NO_STORE })
  }
  if (keys.length === 0) return NextResponse.json({}, { headers: NO_STORE })

  try {
    // User-scoped revenue honors RLS; do not share one member's visible rows with another.
    const version = kind === "overview" ? "v5" : "v3"
    const cacheKey = await normalizedRequestCacheKey(`dashboard-${kind}:${version}:${userId}`, request)
    const result = await readThroughJsonCache({
      key: cacheKey,
      ttlSeconds: 60,
      lockTtlMs: 60_000,
      compute: async () => {
        // Finish in-flight children before releasing the cache's computation lock.
        const results = await Promise.allSettled(keys.map(key =>
          readMetric(request, kind, key, handlers[key], userId)
        ))
        const entries = results.map(result => {
          if (result.status === "rejected") throw result.reason
          return result.value
        })
        return Object.fromEntries(entries)
      },
    })
    if (result.status === "busy") throw new MetricFailure(503, "2")
    if (!isReportBatch(result.value, keys)) throw new MetricFailure(502)
    return NextResponse.json(result.value, {
      headers: { ...NO_STORE, "X-Cache": result.status.toUpperCase() },
    })
  } catch (error) {
    const status = error instanceof MetricFailure ? error.status : 502
    const headers: Record<string, string> = { ...NO_STORE }
    if (error instanceof MetricFailure && error.retryAfter && [429, 503].includes(status)) {
      headers["Retry-After"] = error.retryAfter
    }
    const body = error instanceof MetricFailure && error.availableCurrencies
      ? { error: "Select a currency to view revenue metrics", availableCurrencies: error.availableCurrencies }
      : { error: `Failed to load ${kind} metrics` }
    return NextResponse.json(body, { status, headers })
  }
}