/** @jest-environment node */
import { NextRequest } from 'next/server'
import { POST as googlePOST } from '@/app/api/trends/google/route'
import { POST as redditPOST } from '@/app/api/trends/reddit/route'
import { GoogleTrendsService, RedditTrendsService, TrendsManager } from '@/app/services/trends-service'
import { generateRedditKeywords } from '@/app/services/trends/reddit-keywords'
import { normalizeSegments } from '@/app/services/trends/request-normalization'
import type { TrendSegment } from '@/app/types/trends'

// Keep the actual routes, body reader, Zod validators and cache orchestration.
// Only Redis access and outbound provider network are replaced.
jest.mock('@/lib/redis/control-plane', () => ({
  hashRedisKeyPart: jest.fn(async (value: string) => value),
  getCachedJson: jest.fn(async () => null),
  setCachedJson: jest.fn(async () => true),
  acquireLock: jest.fn(async () => true),
  releaseLock: jest.fn(async () => true),
}))
jest.mock('@/lib/redis/upstash-rest', () => ({
  isRedisConfigured: jest.fn(() => false),
  executeRedisCommand: jest.fn(),
}))

const routes: Record<string, typeof googlePOST> = {
  '/api/trends/google': googlePOST,
  '/api/trends/reddit': redditPOST,
}
const rss = `<rss><channel><item>
  <title><![CDATA[Software automation funding announced]]></title>
  <description><![CDATA[Companies announced new automation software tools with improved efficiency.]]></description>
  <link>https://example.com/automation</link>
  <pubDate>Mon, 05 Oct 2026 12:00:00 GMT</pubDate>
</item></channel></rss>`
const redditProviderData = {
  data: { children: [{ data: {
    title: 'Software automation growth tips',
    score: 720, ups: 720, num_comments: 48, created_utc: 1791201600,
    subreddit: 'software', permalink: '/r/software/comments/real/post/',
    url: 'https://example.com/real-post', selftext: 'Automation tools help software businesses grow.',
  } }] },
}

function segmentFixture(): TrendSegment[] {
  return [
    { id: 'empty', name: '   ', description: null },
    { id: 'null', name: '  Software automation  ', description: null },
    { id: 'long', name: ' Software '.repeat(15), description: `  ${'Automation details '.repeat(60)}  ` },
    ...Array.from({ length: 10 }, (_, index) => ({
      id: `segment-${index}`, name: `Software segment ${index}`, description: index === 0 ? '' : undefined,
    })),
  ]
}

describe('real trend service payloads accepted by real route validators', () => {
  const env = { ...process.env }
  const requests: Array<{ path: string; body: Record<string, unknown>; status?: number }> = []
  let providerCalls: string[]
  let fetchMock: jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    delete process.env.REDDIT_CLIENT_ID
    delete process.env.REDDIT_CLIENT_SECRET
    requests.length = 0
    providerCalls = []
    jest.spyOn(console, 'log').mockImplementation(() => {})
    fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (routes[url]) {
        const call = { path: url, body: JSON.parse(String(init?.body)), status: 0 }
        requests.push(call)
        const response = await routes[url](new NextRequest(`http://localhost${url}`, { ...init, signal: init?.signal ?? undefined }))
        call.status = response.status
        return response
      }
      providerCalls.push(url)
      if (url.startsWith('https://news.google.com/rss/')) return new Response(rss)
      if (url.startsWith('https://www.reddit.com/r/')) return Response.json(redditProviderData)
      throw new Error(`Unexpected test network request: ${url}`)
    })
    global.fetch = fetchMock
  })

  afterEach(() => {
    process.env = { ...env }
    jest.restoreAllMocks()
  })

  it('trims/caps Google segments, omits null descriptions and unused fields, and preserves RSS results', async () => {
    const segments = segmentFixture()
    const original = JSON.stringify(segments)
    const result = await new GoogleTrendsService({ limit: 100 }).fetchTrends(segments)
    expect(requests[0].status).toBe(200)
    expect(requests[0].body).toEqual({
      geo: 'US', hl: 'en', timeframe: 'now 1-d', mode: 'news', limit: 25,
      segments: normalizeSegments(segments, 5),
    })
    const sent = requests[0].body.segments as Array<{ name: string; description?: string }>
    expect(sent).toHaveLength(5)
    expect(sent[0]).toEqual({ name: 'Software automation' })
    expect(sent[1].name).toHaveLength(80)
    expect(sent[1].description).toHaveLength(240)
    expect(JSON.stringify(segments)).toBe(original)
    expect(result.success).toBe(true)
    expect(result.data?.[0]).toMatchObject({
      title: 'Software automation funding announced',
      description: 'Companies announced new automation software tools with improved efficiency.',
      url: 'https://example.com/automation', timestamp: '2026-10-05T12:00:00.000Z',
    })
    expect(providerCalls.length).toBeGreaterThan(0)
  })

  it('caps Reddit at eight segments and twelve of the generated fifteen keywords', async () => {
    const segments = segmentFixture()
    expect(generateRedditKeywords(normalizeSegments(segments, 8))).toHaveLength(15)
    const result = await new RedditTrendsService().fetchTrends(segments)
    expect(requests[0].status).toBe(200)
    const sent = requests[0].body.segments as Array<{ name: string; description?: string }>
    const keywords = requests[0].body.keywords as string[]
    expect(sent).toHaveLength(8)
    expect(sent[0]).not.toHaveProperty('description')
    expect(sent[1].description).toHaveLength(240)
    expect(keywords).toHaveLength(12)
    expect(keywords.every(keyword => keyword.trim().length > 0 && keyword.length <= 80)).toBe(true)
    expect(result.success).toBe(true)
    expect(result.data?.[0]).toMatchObject({
      title: redditProviderData.data.children[0].data.title, score: 720,
      description: 'r/software • 48 comments',
      url: 'https://www.reddit.com/r/software/comments/real/post/',
      metadata: { comments: 48, subreddit: 'software' },
    })
  })

  it('normalizes explicit Reddit keywords after trimming/truncation, before deduplication/capping', async () => {
    await new RedditTrendsService({ keywords: [
      '', '  ', ' software ', 'software', 'x'.repeat(100), ...Array.from({ length: 15 }, (_, i) => `keyword-${i}`),
    ] }).fetchTrends()
    expect(requests[0].status).toBe(200)
    const keywords = requests[0].body.keywords as string[]
    expect(keywords).toHaveLength(12)
    expect(keywords.slice(0, 2)).toEqual(['software', 'x'.repeat(80)])
  })

  it('does not request retired Twitter trends even when explicitly enabled or refreshed', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    const manager = new TrendsManager()
    manager.enablePlatform('twitter')
    const result = await manager.getTrends('twitter', undefined, 15, { forceRefresh: true })
    expect(result).toMatchObject({ success: false, error: 'Platform twitter is not available', platform: 'twitter' })
    expect(result.data).toBeUndefined()
    expect(requests).toHaveLength(0)
    expect(providerCalls).toHaveLength(0)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('loads Google and Reddit by default with no retired-provider requests or errors', async () => {
    const manager = new TrendsManager()
    expect(manager.getEnabledPlatforms()).toEqual(['google', 'reddit'])
    const result = await manager.getAllTrends()
    expect(result).toMatchObject({ success: true, data: { platforms: ['google', 'reddit'], totalCount: 2 } })
    expect(result.platformErrors).toBeUndefined()
    expect(requests.map(request => request.path).sort()).toEqual(['/api/trends/google', '/api/trends/reddit'])
    expect(providerCalls.every(url => !url.includes('twitter.com') && !url.includes('api.x.com'))).toBe(true)
  })

  it('deduplicates concurrent manager/service calls through the real Reddit route and provider', async () => {
    const manager = new TrendsManager()
    const results = await Promise.all([
      manager.getAllTrends(['reddit']), manager.getAllTrends(['reddit']), manager.getTrends('reddit', undefined, 6),
    ])
    expect(results.every(result => result.success)).toBe(true)
    expect(requests).toHaveLength(1)
    expect(providerCalls).toHaveLength(1)
  })

  it('exposes partial failures, not fake data, and fails meaningfully when every requested platform fails', async () => {
    const manager = new TrendsManager()
    const partial = await manager.getAllTrends(['reddit', 'twitter'])
    expect(partial).toMatchObject({
      success: true, data: { platforms: ['reddit'], totalCount: 1 },
      platformErrors: { twitter: 'Platform twitter is not available' },
    })
    expect(partial.data?.trends.every(trend => trend.platform === 'reddit')).toBe(true)
    const allFailed = await manager.getAllTrends(['twitter', 'linkedin'])
    expect(allFailed).toMatchObject({ success: false, platformErrors: {
      twitter: 'Platform twitter is not available', linkedin: 'Platform linkedin is not available',
    } })
    expect(allFailed.error).toContain('Platform twitter is not available')
    expect(allFailed.data).toBeUndefined()
  })

  it('proves unnormalized payloads fail the actual validators (no copied test schemas)', async () => {
    for (const [route, body] of [
      [googlePOST, { segments: segmentFixture() }],
      [googlePOST, { segments: [{ name: 'Software', description: null }] }],
      [redditPOST, { segments: normalizeSegments(segmentFixture(), 9) }],
      [redditPOST, { keywords: Array.from({ length: 15 }, (_, i) => `word-${i}`) }],
    ] as const) {
      const response = await route(new NextRequest('http://localhost/api/trends/test', {
        method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
      }))
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ success: false, error: 'Invalid trend request' })
    }
    expect(providerCalls).toHaveLength(0)
  })
})