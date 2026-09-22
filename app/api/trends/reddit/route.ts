import { NextRequest, NextResponse } from 'next/server'
import {
  getCachedJson,
  hashRedisKeyPart,
  setCachedJson,
} from '@/lib/redis/control-plane'
import {
  normalizedRequestCacheKey,
  readThroughJsonCache,
} from '@/lib/redis/json-cache'
import { z } from 'zod'
import {
  decodeRequestBody,
  readLimitedRequestBody,
  RequestBodyTooLargeError,
} from '@/lib/http/read-limited-request-body'

const MAX_BODY_BYTES = 32 * 1024
const TREND_CACHE_TTL_SECONDS = 180
const TREND_CACHE_LOCK_TTL_MS = 25_000
const requestSchema = z.object({
  subreddit: z.string().trim().regex(/^[A-Za-z0-9_+]{1,100}$/).transform(value => value.toLowerCase()).default('all'),
  sortBy: z.enum(['hot', 'new', 'top', 'rising']).default('hot'),
  timeframe: z.enum(['hour', 'day', 'week', 'month', 'year', 'all']).default('day'),
  limit: z.number().int().min(1).max(25).default(10),
  segments: z.array(z.object({
    name: z.string().trim().max(80).transform(value => value.toLowerCase()),
    description: z.string().trim().max(240).transform(value => value.toLowerCase()).optional(),
  })).max(8).default([]),
  keywords: z.array(z.string().trim().max(80).transform(value => value.toLowerCase())).max(12).default([]),
})

interface RedditPost {
  title: string
  score: number
  ups: number
  num_comments: number
  created_utc: number
  subreddit: string
  permalink: string
  url: string
  selftext?: string
}

interface RedditApiResponse {
  data: {
    children: Array<{
      data: RedditPost
    }>
  }
}

class RedditProviderError extends Error {}

// Dynamic subreddit selection based on segment keywords
function selectSubredditFromSegments(segments: any[]): string {
  if (!segments || segments.length === 0) return 'entrepreneur+business+startups'
  
  console.log('🎯 [Reddit] Selecting subreddits for segments:', segments.map(s => s.name))
  
  // Extract key terms from all segments
  const allSegmentText = segments.map((s: any) => `${s.name} ${s.description || ''}`).join(' ').toLowerCase()
  
  // Universal business subreddits that work for most segments
  const businessSubreddits = ['entrepreneur', 'business', 'startups', 'smallbusiness']
  
  // Dynamic subreddit selection based on content analysis
  const subredditCandidates: string[] = [...businessSubreddits]
  
  // Add relevant subreddits based on common business keywords
  const keywordToSubreddit: { [key: string]: string[] } = {
    'marketing': ['marketing', 'digitalmarketing', 'advertising'],
    'digital': ['digitalmarketing', 'webdev', 'technology'],
    'tech': ['technology', 'programming', 'webdev'],
    'software': ['software', 'programming', 'webdev'],
    'ecommerce': ['ecommerce', 'shopify', 'retail'],
    'finance': ['personalfinance', 'investing', 'fintech'],
    'health': ['health', 'fitness', 'medical'],
    'food': ['food', 'cooking', 'restaurant'],
    'education': ['education', 'teaching', 'learning'],
    'real estate': ['realestate', 'investing'],
    'consulting': ['consulting', 'freelance'],
    'design': ['design', 'graphic_design', 'webdesign'],
    'content': ['content', 'writing', 'blogging'],
    'social': ['socialmedia', 'marketing'],
    'data': ['analytics', 'datascience', 'business']
  }
  
  // Check for keyword matches and add relevant subreddits
  Object.entries(keywordToSubreddit).forEach(([keyword, subreddits]) => {
    if (allSegmentText.includes(keyword)) {
      subredditCandidates.push(...subreddits)
      console.log(`📊 [Reddit] Found "${keyword}" - adding subreddits:`, subreddits)
    }
  })
  
  // Remove duplicates and limit to 4-5 subreddits for better performance
  const uniqueSubreddits = Array.from(new Set(subredditCandidates)).slice(0, 5)
  const finalSubredditString = uniqueSubreddits.join('+')
  
  console.log('✅ [Reddit] Selected subreddits:', finalSubredditString)
  return finalSubredditString
}

// Get Reddit API credentials from environment variables
async function getRedditAccessToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID
  const clientSecret = process.env.REDDIT_CLIENT_SECRET
  
  if (!clientId || !clientSecret) {
    console.log('🔓 [Reddit API] No credentials found, using public API')
    return null
  }

  try {
    console.log('🔑 [Reddit API] Authenticating with Reddit...')

    const tokenCacheKey = `cache:v1:reddit:token:${await hashRedisKeyPart(clientId)}`
    const cachedToken = await getCachedJson<string>(tokenCacheKey)
    if (cachedToken) return cachedToken

    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': process.env.REDDIT_USER_AGENT || 'MarketFit/1.0'
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      console.error('❌ [Reddit API] Auth failed:', response.status)
      return null
    }

    const authData = await response.json() as {
      access_token?: string
      expires_in?: number
    }
    if (!authData.access_token) return null
    const ttl = Math.max(60, Math.min((authData.expires_in || 3600) - 60, 3600))
    await setCachedJson(tokenCacheKey, authData.access_token, ttl)
    console.log('✅ [Reddit API] Authentication successful')
    return authData.access_token
  } catch (error) {
    console.error('❌ [Reddit API] Auth error:', error)
    return null
  }
}

async function loadRedditTrends(input: z.infer<typeof requestSchema>) {
  const { subreddit, sortBy, timeframe, limit, segments, keywords } = input
  const targetSubreddit = segments.length > 0
    ? selectSubredditFromSegments(segments)
    : subreddit
  const accessToken = await getRedditAccessToken()
  const headers: Record<string, string> = {
    'User-Agent': process.env.REDDIT_USER_AGENT || 'MarketFit/1.0'
  }
  const fetchLimit = Math.min(75, Math.max(25, limit * 3))
  let redditUrl: string

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
    redditUrl = `https://oauth.reddit.com/r/${targetSubreddit}/${sortBy}?limit=${fetchLimit}&t=${timeframe}`
    console.log('🔑 [Reddit API] Using authenticated API')
  } else {
    redditUrl = `https://www.reddit.com/r/${targetSubreddit}/${sortBy}.json?limit=${fetchLimit}&t=${timeframe}`
    console.log('🔓 [Reddit API] Using public API (consider adding credentials for better access)')
  }

  console.log('🎯 [Reddit API] Fetching from:', redditUrl.replace(accessToken || '', '[TOKEN]'))
  console.log('📊 [Reddit API] Target subreddits:', targetSubreddit)
  console.log('🔍 [Reddit API] Filtering for segments:', segments.map(segment => segment.name).join(', ') || 'None')

  const response = await fetch(redditUrl, {
    headers,
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    console.warn(`Reddit API error: ${response.status}`)
    throw new RedditProviderError()
  }

  const data: RedditApiResponse = await response.json()
  let relevantPosts = data.data.children

  if (segments.length > 0 && keywords.length > 0) {
    console.log('🔍 [Reddit API] Starting relevance filtering with keywords:', keywords)

    const scoredPosts = data.data.children
      .map(post => {
        const postData = post.data
        const title = postData.title.toLowerCase()
        const selftext = (postData.selftext || '').toLowerCase()
        const subredditName = postData.subreddit.toLowerCase()
        let relevanceScore = 0
        const matchedKeywords: string[] = []

        keywords.forEach((keyword: string) => {
          if (title.includes(keyword)) {
            relevanceScore += 5
            matchedKeywords.push(`title:${keyword}`)
          }
          if (title.split(/\s+/).includes(keyword)) {
            relevanceScore += 8
            matchedKeywords.push(`title-exact:${keyword}`)
          }
          if (selftext.includes(keyword)) {
            relevanceScore += 2
            matchedKeywords.push(`content:${keyword}`)
          }
          if (subredditName.includes(keyword)) {
            relevanceScore += 3
            matchedKeywords.push(`subreddit:${keyword}`)
          }
        })

        if (matchedKeywords.length > 1) {
          relevanceScore += matchedKeywords.length * 2
        }
        relevanceScore +=
          Math.min(postData.score / 100, 3) +
          Math.min(postData.num_comments / 20, 2)

        return {
          post,
          relevanceScore: Math.round(relevanceScore * 10) / 10,
          matchedKeywords,
          title: postData.title,
          subreddit: postData.subreddit,
          score: postData.score
        }
      })
      .filter(item => item.relevanceScore > 2)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)

    console.log('📊 [Reddit API] Top relevant posts found:')
    scoredPosts.slice(0, 5).forEach((item, index) => {
      console.log(`  ${index + 1}. [${item.relevanceScore}] ${item.title.substring(0, 60)}... (r/${item.subreddit})`)
      console.log(`     Keywords: ${item.matchedKeywords.join(', ')}`)
    })

    relevantPosts = scoredPosts.slice(0, limit).map(item => item.post)
    console.log(`✅ [Reddit API] Selected ${relevantPosts.length} relevant posts from ${data.data.children.length} total`)
  }

  const trends = relevantPosts.slice(0, limit).map((post) => {
    const postData = post.data
    const engagementRatio = postData.num_comments > 0
      ? postData.score / postData.num_comments
      : postData.score
    const change = Math.min(Math.max(engagementRatio * 0.1 - 5, -30), 30)

    return {
      title: postData.title,
      query: postData.title,
      value: postData.score,
      change: parseFloat(change.toFixed(1)),
      category: postData.subreddit,
      relatedQueries: [postData.subreddit, 'reddit', 'discussion'],
      metadata: {
        subreddit: postData.subreddit,
        comments: postData.num_comments,
        permalink: postData.permalink,
        url: postData.url,
        created: postData.created_utc
      }
    }
  })

  return {
    success: true,
    trends,
    metadata: {
      subreddit,
      sortBy,
      timeframe,
      timestamp: new Date().toISOString(),
      source: 'reddit-api',
      total: trends.length
    }
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
    const input = parsed.data
    const cacheUrl = new URL('https://cache.local')
    cacheUrl.searchParams.set('input', JSON.stringify(input))
    const cacheKey = await normalizedRequestCacheKey(
      'provider:trends:reddit',
      new Request(cacheUrl)
    )
    const cached = await readThroughJsonCache({
      key: cacheKey,
      ttlSeconds: TREND_CACHE_TTL_SECONDS,
      lockTtlMs: TREND_CACHE_LOCK_TTL_MS,
      compute: () => loadRedditTrends(input),
    })

    if (cached.status === 'busy') {
      return NextResponse.json(
        { success: false, error: 'Reddit trends are being refreshed' },
        { status: 503, headers: { 'Retry-After': '2' } }
      )
    }
    return NextResponse.json(cached.value)

  } catch (error) {
    if (error instanceof RedditProviderError) {
      return NextResponse.json(
        { success: false, error: 'Reddit provider request failed' },
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
    console.error('Reddit Trends API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch Reddit trends data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 