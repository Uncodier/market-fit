/** @jest-environment node */
import { GoogleTrendsService, RedditTrendsService, TrendsManager } from '@/app/services/trends-service'
import { TwitterTrendsService } from '@/app/services/trends/twitter-service'
import { FAILURE_COOLDOWN_MS, PROVIDER_TIMEOUT_MS, SUCCESS_CACHE_MS } from '@/app/services/trends/provider-request'
import type { TrendSegment } from '@/app/types/trends'

const redditResult = { success: true, trends: [{
  title: 'Automation software funding growth', value: 0, change: 0,
  metadata: { subreddit: 'software', comments: 0, permalink: '/r/software/real', created: 1791201600 },
}] }

describe('trend request lifecycle and safe failures', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async () => Response.json(redditResult))
    global.fetch = fetchMock
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('deduplicates failures in-flight and cools them down without permanently disabling Twitter', async () => {
    jest.useFakeTimers()
    fetchMock.mockResolvedValue(Response.json({ success: false, error: 'Twitter integration is not configured' }, { status: 503 }))
    const service = new TwitterTrendsService()
    const results = await Promise.all([service.fetchTrends(), service.fetchTrends(), service.fetchTrends()])
    expect(results.every(result => !result.success)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await service.fetchTrends()
    jest.advanceTimersByTime(FAILURE_COOLDOWN_MS - 1)
    await service.fetchTrends()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(1)
    fetchMock.mockResolvedValue(Response.json({ success: true, trends: [{ name: '#Real', tweet_volume: 1200 }] }))
    expect((await service.fetchTrends()).success).toBe(true)
    expect(service.isEnabled).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('permits a manual retry during cooldown but still shares simultaneous manual retries', async () => {
    fetchMock.mockImplementation(async () => Response.json({ success: false, error: 'Twitter trends are being refreshed' }, { status: 503 }))
    const manager = new TrendsManager()
    expect((await manager.getAllTrends(['twitter'])).success).toBe(false)
    const results = await Promise.all([
      manager.getAllTrends(['twitter'], undefined, { forceRefresh: true }),
      manager.getAllTrends(['twitter'], undefined, { forceRefresh: true }),
    ])
    expect(results.every(result => result.platformErrors?.twitter === 'Twitter trends are being refreshed')).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each([
    [401, 'Authentication required to fetch Twitter trends'],
    [403, 'Access denied to Twitter trends'],
    [400, 'Invalid Twitter trends request'],
    [413, 'Twitter trends request is too large'],
    [429, 'Twitter trends rate limit reached. Please try again later'],
    [502, 'Failed to fetch Twitter trends'],
    [503, 'Twitter trends are temporarily unavailable'],
    [500, 'Failed to fetch Twitter trends'],
  ])('uses fixed status errors, never raw body/details, for HTTP %i', async (status, error) => {
    fetchMock.mockResolvedValue(Response.json({ error: 'sensitive provider token/stack', details: 'private data' }, { status }))
    expect(await new TwitterTrendsService().fetchTrends()).toMatchObject({ success: false, error })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not trust an allowlisted Twitter message on the wrong status', async () => {
    fetchMock.mockResolvedValue(Response.json({ success: false, error: 'Twitter integration is not configured' }, { status: 500 }))
    expect(await new TwitterTrendsService().fetchTrends()).toMatchObject({ error: 'Failed to fetch Twitter trends' })
  })

  it('does not treat success:false in a 200 body as success or pass through its raw error', async () => {
    fetchMock.mockResolvedValue(Response.json({ success: false, error: 'raw internal exception', trends: [] }))
    expect(await new RedditTrendsService().fetchTrends()).toMatchObject({ success: false, error: 'Failed to fetch Reddit trends' })
  })

  it('handles invalid success bodies, non-JSON errors and network rejection safely without console spam', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValueOnce(Response.json({ success: true, trends: null }))
    fetchMock.mockResolvedValueOnce(new Response('private HTML diagnostics', { status: 403 }))
    fetchMock.mockRejectedValueOnce(new Error('private network token'))
    expect(await new GoogleTrendsService().fetchTrends()).toMatchObject({ success: false, error: 'Invalid Google trends response' })
    expect(await new RedditTrendsService().fetchTrends()).toMatchObject({ success: false, error: 'Access denied to Reddit trends' })
    expect(await new TwitterTrendsService().fetchTrends()).toMatchObject({ success: false, error: 'Failed to fetch Twitter trends' })
    expect(consoleError).not.toHaveBeenCalled()
  })

  it.each(['google', 'reddit', 'twitter'] as const)('bounds %s fetch waits, aborts, and never retries automatically', async platform => {
    jest.useFakeTimers()
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}))
    const manager = new TrendsManager()
    const pending = manager.getTrends(platform)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const signal = fetchMock.mock.calls[0][1]?.signal
    await jest.advanceTimersByTimeAsync(PROVIDER_TIMEOUT_MS[platform])
    const result = await pending
    expect(result.success).toBe(false)
    expect(result.error).toContain('timed out')
    expect(signal?.aborted).toBe(true)
    await jest.advanceTimersByTimeAsync(FAILURE_COOLDOWN_MS * 3)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('also bounds a stalled response body, releasing in-flight state for an explicit retry', async () => {
    jest.useFakeTimers()
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => new Promise(() => {}) } as Response)
    const service = new TwitterTrendsService()
    const pending = service.fetchTrends()
    await jest.advanceTimersByTimeAsync(PROVIDER_TIMEOUT_MS.twitter)
    expect((await pending).error).toContain('timed out')
    fetchMock.mockResolvedValue(Response.json({ success: true, trends: [] }))
    expect((await service.fetchTrends(undefined, { forceRefresh: true })).success).toBe(true)
  })

  it('keys requests by names, descriptions, limits and provider config, not just segment IDs', async () => {
    const manager = new TrendsManager()
    const segments: TrendSegment[] = [{ id: 'same', name: 'Software', description: 'Automation' }]
    await manager.getTrends('reddit', segments, 2)
    await manager.getTrends('reddit', [{ ...segments[0] }], 2)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await manager.getTrends('reddit', [{ ...segments[0], description: 'Healthcare' }], 2)
    await manager.getTrends('reddit', [{ ...segments[0], name: 'Finance' }], 2)
    await manager.getTrends('reddit', segments, 3)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    const service = new RedditTrendsService()
    await service.fetchTrends()
    service.config.subreddit = 'technology'
    await service.fetchTrends()
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })

  it('shares a still-pending request across rerenders and force refresh while isolating concurrent contexts', async () => {
    const releases: Array<() => void> = []
    fetchMock.mockImplementation(() => new Promise<Response>(resolve => {
      releases.push(() => resolve(Response.json(redditResult)))
    }))
    const manager = new TrendsManager()
    const segment = { id: 'same', name: 'Software', description: 'Automation' }
    const first = manager.getTrends('reddit', [segment], 2)
    const rerender = manager.getTrends('reddit', [{ ...segment }], 2)
    const manual = manager.getTrends('reddit', [segment], 2, { forceRefresh: true })
    const otherDescription = manager.getTrends('reddit', [{ ...segment, description: 'Finance' }], 2)
    const otherLimit = manager.getTrends('reddit', [segment], 7)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    releases.forEach(release => release())
    const results = await Promise.all([first, rerender, manual, otherDescription, otherLimit])
    expect(results.every(result => result.success)).toBe(true)
    expect(results[0].data).toBe(results[1].data)
    expect(results[0].data).toBe(results[2].data)
    expect(results[0].data).not.toBe(results[3].data)
  })

  it('does not race or leave shared service limits changed for concurrent differing limits', async () => {
    const manager = new TrendsManager()
    await Promise.all([manager.getTrends('reddit', undefined, 2), manager.getTrends('reddit', undefined, 7)])
    await manager.getTrends('reddit')
    expect(fetchMock.mock.calls.map(call => JSON.parse(String(call[1]?.body)).limit)).toEqual([2, 7, 15])
  })

  it('expires successful caches and does not make requests without a caller', async () => {
    jest.useFakeTimers()
    const service = new RedditTrendsService()
    await service.fetchTrends()
    await service.fetchTrends()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(SUCCESS_CACHE_MS)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await service.fetchTrends()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('preserves zero scores/changes and avoids random fallbacks for missing Google metrics', async () => {
    expect((await new RedditTrendsService().fetchTrends()).data?.[0]).toMatchObject({ score: 0, change: 0 })
    fetchMock.mockResolvedValue(Response.json({ success: true, trends: [
      { title: 'Real headline', relevance_score: 0, trend_change: 0 }, { title: 'Second real headline' },
    ] }))
    const result = await new GoogleTrendsService().fetchTrends()
    expect(result.data?.[0]).toMatchObject({ title: 'Real headline', score: 0, change: 0 })
    expect(result.data?.[1].score).toBeUndefined()
    expect(result.data?.[1].change).toBeUndefined()
  })

  it('reports all network failures via aggregation and allows successful empty results', async () => {
    fetchMock.mockRejectedValue(new Error('private error'))
    expect(await new TrendsManager().getAllTrends()).toMatchObject({ success: false, platformErrors: {
      google: 'Failed to fetch Google trends', reddit: 'Failed to fetch Reddit trends', twitter: 'Failed to fetch Twitter trends',
    } })
    fetchMock.mockResolvedValue(Response.json({ success: true, trends: [] }))
    expect(await new TrendsManager().getAllTrends(['google'])).toMatchObject({ success: true, data: { trends: [], platforms: ['google'] } })
    expect(await new TrendsManager().getAllTrends([])).toEqual({ success: false, error: 'No trend platforms are enabled' })
  })

  it('preserves relevance filtering, commercial signals, analytics and cross-platform scoring', async () => {
    fetchMock.mockImplementation(async input => String(input).endsWith('google')
      ? Response.json({ success: true, trends: [{ title: 'Automation software funding growth', relevance_score: 10 }] })
      : Response.json(redditResult))
    const result = await new TrendsManager().getAllTrends(['google', 'reddit'], [{
      id: 'software', name: 'Automation software', description: 'Software funding',
      icp: { pain_points: ['automation'], goals: ['growth'], industry: 'software' },
    }], { sortBy: 'cross-platform', limitPerPlatform: 1 })
    expect(result.success).toBe(true)
    expect(result.data?.trends).toHaveLength(2)
    expect(result.data?.analytics?.crossPlatformTrends).toBe(2)
    for (const trend of result.data?.trends ?? []) {
      expect(trend.relevanceScore).toBeGreaterThan(100)
      expect(trend.matchedKeywords).toContain('segment-direct:automation')
      expect(trend.commercialSignals).toContain('commercial:growth')
      expect(trend.businessImpact).toBe('high')
      expect(trend.crossPlatformBonus).toBeGreaterThan(0)
    }
  })

  it('handles null descriptions and malformed/empty runtime names during local scoring too', async () => {
    const manager = new TrendsManager()
    const malformed = { id: 'malformed', name: null } as unknown as TrendSegment
    const result = await manager.getAllTrends(['reddit'], [
      malformed, { id: 'empty', name: '  ', description: null },
      { id: 'real', name: ' Software ', description: null },
    ])
    expect(result.success).toBe(true)
    expect(result.data?.trends[0].matchedKeywords).toContain('segment-direct:software')
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).segments).toEqual([{ name: 'Software' }])
  })

  it('recomputes private commercial context outside the shared public-provider cache', async () => {
    const manager = new TrendsManager()
    const base = { id: 'one', name: 'Automation software', description: null }
    const first = await manager.getAllTrends(['reddit'], [{ ...base, icp: { pain_points: ['Automation software funding growth'] } }])
    const second = await manager.getAllTrends(['reddit'], [{ ...base, icp: { pain_points: ['unknownproblem'] } }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(first.data?.trends[0].matchedKeywords).toContain('title:Automation software funding growth')
    expect(second.data?.trends[0].matchedKeywords).not.toContain('title:Automation software funding growth')
    expect(first.data?.trends[0]).not.toBe(second.data?.trends[0])
  })
})