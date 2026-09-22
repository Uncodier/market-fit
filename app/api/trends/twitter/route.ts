import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  decodeRequestBody,
  readLimitedRequestBody,
  RequestBodyTooLargeError,
} from '@/lib/http/read-limited-request-body'
import {
  normalizedRequestCacheKey,
  readThroughJsonCache,
} from '@/lib/redis/json-cache'

const MAX_BODY_BYTES = 8 * 1024
const TREND_CACHE_TTL_SECONDS = 180
const TREND_CACHE_LOCK_TTL_MS = 12_000
const requestSchema = z.object({
  woeid: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(25).default(10),
})

interface TwitterTrend {
  name: string
  url: string
  promoted_content: string | null
  query: string
  tweet_volume: number | null
}

interface TwitterApiResponse {
  trends: TwitterTrend[]
  as_of: string
  created_at: string
  locations: Array<{ name: string; woeid: number }>
}

class TwitterProviderError extends Error {}

async function loadTwitterTrends(
  input: z.infer<typeof requestSchema>,
  bearerToken: string
) {
  const twitterUrl = `https://api.twitter.com/1.1/trends/place.json?id=${input.woeid}`
  const response = await fetch(twitterUrl, {
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'User-Agent': process.env.TWITTER_USER_AGENT || 'MarketFit/1.0'
    },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    console.error('❌ [Twitter API] Failed to fetch:', response.status)
    throw new TwitterProviderError()
  }

  const data = await response.json() as TwitterApiResponse[]
  const trendsData =
    Array.isArray(data) && Array.isArray(data[0]?.trends)
      ? data[0].trends
      : []

  trendsData.sort((a, b) => (b.tweet_volume || 0) - (a.tweet_volume || 0))

  return {
    success: true,
    trends: trendsData.slice(0, input.limit),
    timestamp: new Date().toISOString()
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(
      JSON.parse(
        decodeRequestBody(
          await readLimitedRequestBody(request, MAX_BODY_BYTES)
        )
      )
    )
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid trend request' },
        { status: 400 }
      )
    }

    const bearerToken = process.env.TWITTER_BEARER_TOKEN
    if (!bearerToken) {
      return NextResponse.json(
        { success: false, error: 'Twitter integration is not configured' },
        { status: 503 }
      )
    }

    const input = parsed.data
    const cacheUrl = new URL('https://cache.local')
    cacheUrl.searchParams.set('input', JSON.stringify(input))
    const cacheKey = await normalizedRequestCacheKey(
      'provider:trends:twitter',
      new Request(cacheUrl)
    )
    const cached = await readThroughJsonCache({
      key: cacheKey,
      ttlSeconds: TREND_CACHE_TTL_SECONDS,
      lockTtlMs: TREND_CACHE_LOCK_TTL_MS,
      compute: () => loadTwitterTrends(input, bearerToken),
    })

    if (cached.status === 'busy') {
      return NextResponse.json(
        { success: false, error: 'Twitter trends are being refreshed' },
        { status: 503, headers: { 'Retry-After': '2' } }
      )
    }
    return NextResponse.json(cached.value)

  } catch (error) {
    if (error instanceof TwitterProviderError) {
      return NextResponse.json(
        { success: false, error: 'Twitter provider request failed' },
        { status: 502 }
      )
    }
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 413 }
      )
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }
    console.error('❌ [Twitter API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch Twitter trends' },
      { status: 500 }
    )
  }
}
