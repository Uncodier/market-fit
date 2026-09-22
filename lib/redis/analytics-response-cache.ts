import { NextResponse } from "next/server"
import {
  normalizedRequestCacheKey,
  readThroughJsonCache,
} from "@/lib/redis/json-cache"

const ANALYTICS_CACHE_TTL_SECONDS = 60

type CachedResponse = {
  body: string
  headers: Array<[string, string]>
  status: number
  statusText: string
}

class UncacheableResponse {
  constructor(readonly response: Response) {}
}

export async function readThroughAnalyticsResponseCache(options: {
  request: Request
  namespace: string
  siteId: string
  lockTtlMs?: number
  load: () => Promise<Response>
}): Promise<Response> {
  const cacheUrl = new URL(options.request.url)
  cacheUrl.searchParams.set("siteId", options.siteId)
  const cacheKey = await normalizedRequestCacheKey(
    `analytics:${options.namespace}`,
    new Request(cacheUrl)
  )

  try {
    const result = await readThroughJsonCache<CachedResponse>({
      key: cacheKey,
      ttlSeconds: ANALYTICS_CACHE_TTL_SECONDS,
      lockTtlMs: options.lockTtlMs,
      compute: async () => {
        const response = await options.load()
        if (!response.ok) throw new UncacheableResponse(response)

        return {
          body: await response.text(),
          headers: Array.from(response.headers.entries()),
          status: response.status,
          statusText: response.statusText,
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
    return new Response(result.value.body, {
      status: result.value.status,
      statusText: result.value.statusText,
      headers,
    })
  } catch (error) {
    if (error instanceof UncacheableResponse) return error.response
    throw error
  }
}
