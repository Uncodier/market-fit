import { act, renderHook, waitFor } from '@testing-library/react'
import { useTrendsResults } from '@/app/components/trends/use-trends-results'
import { trendsManager } from '@/app/services/trends-service'
import type { AggregatedTrendsResponse, TrendItem } from '@/app/types/trends'

jest.mock('@/app/services/trends-service', () => ({ trendsManager: { getAllTrends: jest.fn() } }))
const getAllTrends = jest.mocked(trendsManager.getAllTrends)
const item: TrendItem = { id: 'current', platform: 'google', title: 'Current result', timestamp: '' }
const success: AggregatedTrendsResponse = {
  success: true, data: { trends: [item], platforms: ['google'], totalCount: 1, lastUpdated: '2026-10-05' }
}
const failure: AggregatedTrendsResponse = { success: false, error: 'Providers are unavailable', platformErrors: { google: 'Timed out' } }
function deferred() {
  let resolve!: (value: AggregatedTrendsResponse) => void
  const promise = new Promise<AggregatedTrendsResponse>(callback => { resolve = callback })
  return { promise, resolve }
}
const options = { currentSiteId: 'site-a', sortBy: 'relevance', view: 'section' } as const
beforeEach(() => getAllTrends.mockReset())

it('allows a ready standalone context with optional segments omitted', async () => {
  getAllTrends.mockResolvedValue(success)
  const { result } = renderHook(() => useTrendsResults(options))
  await waitFor(() => expect(result.current.status).toBe('success'))
  expect(getAllTrends).toHaveBeenCalledWith(['google', 'reddit'], [], {
    limitPerPlatform: 15, sortBy: 'relevance', forceRefresh: false
  })
})

it('fences same-context overlapping manual retries so the newest failure replaces success', async () => {
  const first = deferred()
  const second = deferred()
  getAllTrends.mockResolvedValueOnce(success).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const { result } = renderHook(() => useTrendsResults(options))
  await waitFor(() => expect(result.current.trends).toEqual([item]))
  act(() => result.current.refresh())
  await waitFor(() => expect(getAllTrends).toHaveBeenCalledTimes(2))
  act(() => result.current.refresh())
  await waitFor(() => expect(getAllTrends).toHaveBeenCalledTimes(3))
  await act(async () => second.resolve(failure))
  await act(async () => first.resolve(success))
  expect(result.current.status).toBe('failed')
  expect(result.current.trends).toEqual([])
  expect(result.current.lastUpdated).toBe('')
})

it('does not let an old failure replace a newer context success', async () => {
  const old = deferred()
  getAllTrends.mockReturnValueOnce(old.promise).mockResolvedValueOnce(success)
  const { result, rerender } = renderHook(({ site }) => useTrendsResults({ ...options, currentSiteId: site }), {
    initialProps: { site: 'site-a' }
  })
  await waitFor(() => expect(getAllTrends).toHaveBeenCalledTimes(1))
  rerender({ site: 'site-b' })
  await waitFor(() => expect(result.current.status).toBe('success'))
  await act(async () => old.resolve(failure))
  expect(result.current.trends).toEqual([item])
  expect(result.current.platformErrors).toEqual({})
})

it('hides previous results when context becomes unavailable and does not request on manual retry', async () => {
  getAllTrends.mockResolvedValue(success)
  const { result, rerender } = renderHook(({ ready }) => useTrendsResults({ ...options, contextReady: ready }), {
    initialProps: { ready: true }
  })
  await waitFor(() => expect(result.current.status).toBe('success'))
  rerender({ ready: false })
  expect(result.current.trends).toEqual([])
  expect(result.current.lastUpdated).toBe('')
  expect(result.current.isLoading).toBe(false)
  act(() => result.current.refresh())
  expect(getAllTrends).toHaveBeenCalledTimes(1)
})

it('ignores stale responses after unmount and cancels unstarted requests', async () => {
  const old = deferred()
  getAllTrends.mockReturnValueOnce(old.promise).mockResolvedValueOnce(failure)
  const mounted = renderHook(() => useTrendsResults(options))
  await waitFor(() => expect(getAllTrends).toHaveBeenCalledTimes(1))
  mounted.unmount()
  const current = renderHook(() => useTrendsResults(options))
  await waitFor(() => expect(current.result.current.status).toBe('failed'))
  await act(async () => old.resolve(success))
  expect(current.result.current.trends).toEqual([])
  current.unmount()
  const cancelled = renderHook(() => useTrendsResults(options))
  cancelled.unmount()
  await act(async () => {})
  expect(getAllTrends).toHaveBeenCalledTimes(2)
})

it('does not treat success:true with all failed providers as healthy', async () => {
  getAllTrends.mockResolvedValue({ ...success, platformErrors: { google: 'Timed out', reddit: 'Unavailable' } })
  const { result } = renderHook(() => useTrendsResults(options))
  await waitFor(() => expect(result.current.status).toBe('failed'))
  expect(result.current.trends).toEqual([])
  expect(result.current.lastUpdated).toBe('')
})