import { NextRequest, NextResponse } from 'next/server'
import {
  getCachedJson,
  hashRedisKeyPart,
  setCachedJson,
} from '@/lib/redis/control-plane'
import { z } from 'zod'
import {
  decodeRequestBody,
  readLimitedRequestBody,
  RequestBodyTooLargeError,
} from '@/lib/http/read-limited-request-body'

const MAX_BODY_BYTES = 32 * 1024
const requestSchema = z.object({
  subreddit: z.string().regex(/^[A-Za-z0-9_+]{1,100}$/).default('all'),
  sortBy: z.enum(['hot', 'new', 'top', 'rising']).default('hot'),
  timeframe: z.enum(['hour', 'day', 'week', 'month', 'year', 'all']).default('day'),
  limit: z.number().int().min(1).max(25).default(10),
  segments: z.array(z.object({
    name: z.string().max(80),
    description: z.string().max(240).optional(),
  })).max(8).default([]),
  keywords: z.array(z.string().max(80)).max(12).default([]),
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
    const { subreddit, sortBy, timeframe, limit, segments, keywords } = parsed.data

    // Smart subreddit selection based on segments
    const targetSubreddit = segments && segments.length > 0 ? selectSubredditFromSegments(segments) : subreddit
    
    // Try to get access token for official API
    const accessToken = await getRedditAccessToken()
    
    // Prepare headers
    const headers: Record<string, string> = {
      'User-Agent': process.env.REDDIT_USER_AGENT || 'MarketFit/1.0'
    }
    
    // Use official API if we have token, otherwise fallback to public API
    let redditUrl: string
    const fetchLimit = Math.min(75, Math.max(25, limit * 3))
    
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
    console.log('🔍 [Reddit API] Filtering for segments:', segments?.map((s: any) => s.name).join(', ') || 'None')

    const response = await fetch(redditUrl, {
      headers,
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      console.warn(`Reddit API error: ${response.status}`)
      return NextResponse.json(
        { success: false, error: 'Reddit provider request failed' },
        { status: 502 }
      )
    }

    const data: RedditApiResponse = await response.json()
    
    // Filter posts based on segment relevance if segments are provided
    let relevantPosts = data.data.children
    
    if (segments && segments.length > 0 && keywords && keywords.length > 0) {
      console.log('🔍 [Reddit API] Starting relevance filtering with keywords:', keywords)
      
      // Create advanced relevance scoring
      const scoredPosts = data.data.children
        .map(post => {
          const postData = post.data
          const title = postData.title.toLowerCase()
          const selftext = (postData.selftext || '').toLowerCase()
          const subredditName = postData.subreddit.toLowerCase()
          
          let relevanceScore = 0
          let matchedKeywords: string[] = []
          
          keywords.forEach((keyword: string) => {
            const keywordLower = keyword.toLowerCase()
            
            // Title matches (highest weight)
            if (title.includes(keywordLower)) {
              relevanceScore += 5
              matchedKeywords.push(`title:${keyword}`)
            }
            
            // Exact word matches in title (even higher weight)
            const titleWords = title.split(/\s+/)
            if (titleWords.includes(keywordLower)) {
              relevanceScore += 8
              matchedKeywords.push(`title-exact:${keyword}`)
            }
            
            // Self text matches
            if (selftext.includes(keywordLower)) {
              relevanceScore += 2
              matchedKeywords.push(`content:${keyword}`)
            }
            
            // Subreddit relevance boost
            if (subredditName.includes(keywordLower)) {
              relevanceScore += 3
              matchedKeywords.push(`subreddit:${keyword}`)
            }
          })
          
          // Boost posts with multiple keyword matches
          if (matchedKeywords.length > 1) {
            relevanceScore += matchedKeywords.length * 2
          }
          
          // Boost posts with good engagement
          const engagementBoost = Math.min(postData.score / 100, 3) + Math.min(postData.num_comments / 20, 2)
          relevanceScore += engagementBoost
          
          return { 
            post, 
            relevanceScore: Math.round(relevanceScore * 10) / 10,
            matchedKeywords,
            title: postData.title,
            subreddit: postData.subreddit,
            score: postData.score
          }
        })
        .filter(item => item.relevanceScore > 2) // Higher threshold for relevance
        .sort((a, b) => b.relevanceScore - a.relevanceScore) // Sort by relevance
      
      console.log('📊 [Reddit API] Top relevant posts found:')
      scoredPosts.slice(0, 5).forEach((item, i) => {
        console.log(`  ${i+1}. [${item.relevanceScore}] ${item.title.substring(0, 60)}... (r/${item.subreddit})`)
        console.log(`     Keywords: ${item.matchedKeywords.join(', ')}`)
      })
      
      relevantPosts = scoredPosts
        .slice(0, limit)
        .map(item => item.post)
      
      console.log(`✅ [Reddit API] Selected ${relevantPosts.length} relevant posts from ${data.data.children.length} total`)
    }
    
    // Transform Reddit posts to our trend format
    const trends = relevantPosts.slice(0, limit).map((post, index) => {
      const postData = post.data
      
      // Calculate trend change (mock calculation based on score vs comments ratio)
      const engagementRatio = postData.num_comments > 0 ? postData.score / postData.num_comments : postData.score
      const change = Math.min(Math.max(engagementRatio * 0.1 - 5, -30), 30) // Normalize to -30 to +30
      
      return {
        title: postData.title,
        query: postData.title,
        value: postData.score,
        change: parseFloat(change.toFixed(1)),
        category: postData.subreddit,
        relatedQueries: [
          postData.subreddit,
          'reddit',
          'discussion'
        ],
        metadata: {
          subreddit: postData.subreddit,
          comments: postData.num_comments,
          permalink: postData.permalink,
          url: postData.url,
          created: postData.created_utc
        }
      }
    })

    return NextResponse.json({
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
    })

  } catch (error) {
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