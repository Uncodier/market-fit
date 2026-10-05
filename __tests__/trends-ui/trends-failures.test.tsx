import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { TrendsSection } from '@/app/components/trends/TrendsSection'
import { TrendsColumn } from '@/app/components/trends/TrendsColumn'
import { trendsManager } from '@/app/services/trends-service'
import type { AggregatedTrendsResponse, TrendItem } from '@/app/types/trends'

jest.mock('@/app/services/trends-service', () => ({ trendsManager: { getAllTrends: jest.fn() } }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock('@/app/components/trends/TrendDetailModal', () => ({
  TrendDetailModal: ({ trend, isOpen }: { trend: TrendItem | null; isOpen: boolean }) =>
    isOpen ? <div data-testid="trend-detail">{trend?.title}</div> : null
}))
jest.mock('@/app/components/trends/TrendCard', () => ({
  TrendCard: ({ trend, onClick }: { trend: TrendItem; onClick: (trend: TrendItem) => void }) =>
    <button onClick={() => onClick(trend)}>{trend.title}</button>
}))
jest.mock('@/app/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

const getAllTrends = jest.mocked(trendsManager.getAllTrends)
const segments = [{ id: 'segment-a', name: 'Marketing', description: 'Growth goals' }]
const trend: TrendItem = { id: 'real-trend', platform: 'reddit', title: 'Real provider result', score: 200, timestamp: '2026-10-05T00:00:00Z' }
const failures: AggregatedTrendsResponse = {
  success: false,
  error: 'All trend providers are unavailable',
  platformErrors: { google: 'Google request failed (503)', reddit: 'Reddit request timed out' }
}
function success(trends: TrendItem[] = [trend]): AggregatedTrendsResponse {
  return { success: true, data: { trends, platforms: ['reddit'], totalCount: trends.length, lastUpdated: '2026-10-05T00:00:00Z' } }
}
function deferred() {
  let resolve!: (response: AggregatedTrendsResponse) => void
  const promise = new Promise<AggregatedTrendsResponse>(callback => { resolve = callback })
  return { promise, resolve }
}

const views = ['table', 'cards', 'column'] as const
type View = typeof views[number]
function ui(view: View, site: string | null = 'site-a', nextSegments: typeof segments | undefined = segments, contextReady = true) {
  const props = { currentSiteId: site ?? undefined, segments: nextSegments, contextReady }
  return view === 'column' ? <TrendsColumn {...props} /> : <TrendsSection {...props} displayMode={view} />
}

describe.each(views)('%s trends failures', view => {
  let errorLog: jest.SpyInstance
  let consoleLog: jest.SpyInstance
  beforeEach(() => {
    getAllTrends.mockReset()
    jest.mocked(toast.error).mockClear()
    jest.mocked(toast.success).mockClear()
    errorLog = jest.spyOn(console, 'error').mockImplementation(() => {})
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    errorLog.mockRestore()
    consoleLog.mockRestore()
  })

  it('shows real per-provider failures, not a healthy empty state or notifications, and retries manually', async () => {
    getAllTrends.mockResolvedValue(failures)
    render(ui(view))
    expect(await screen.findByText('Trends are unavailable')).toBeInTheDocument()
    expect(screen.getByText('Google Trends unavailable:')).toBeInTheDocument()
    expect(screen.getByText('Reddit unavailable:')).toBeInTheDocument()
    expect(screen.queryByText('Twitter unavailable:')).not.toBeInTheDocument()
    expect(screen.getByText(/Google request failed \(503\)/)).toBeInTheDocument()
    expect(screen.getByText(/Reddit request timed out/)).toBeInTheDocument()
    expect(screen.queryByText('No trends available')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh trends' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))
    await waitFor(() => expect(getAllTrends).toHaveBeenCalledTimes(2))
    expect(getAllTrends).toHaveBeenLastCalledWith(['google', 'reddit'], segments, expect.objectContaining({ forceRefresh: true }))
    await screen.findByText('Trends are unavailable')
    expect(toast.error).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(errorLog).not.toHaveBeenCalled()
    expect(consoleLog).not.toHaveBeenCalled()
  })

  it('preserves partial results and provider failures without claiming full success on refresh', async () => {
    getAllTrends.mockResolvedValue({ ...success(), platformErrors: { google: 'Google request failed (503)' } })
    render(ui(view))
    expect(await screen.findByText(trend.title)).toBeInTheDocument()
    expect(screen.getByText('Some trend providers are unavailable')).toBeInTheDocument()
    expect(screen.queryByText('Reddit unavailable:')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh trends' }))
    await waitFor(() => expect(getAllTrends).toHaveBeenCalledTimes(2))
    await screen.findByText(trend.title)
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('excludes retired Twitter results, badges, notices and requests on load and refresh', async () => {
    const retired: TrendItem = { ...trend, id: 'retired', platform: 'twitter', title: 'Retired X result' }
    getAllTrends.mockResolvedValue({ ...success([retired, trend]), platformErrors: { twitter: 'Retired X unavailable' } })
    render(ui(view))
    await screen.findByText(trend.title)
    expect(getAllTrends).toHaveBeenCalledWith(['google', 'reddit'], segments, expect.objectContaining({ forceRefresh: false }))
    expect(screen.queryByText(retired.title)).not.toBeInTheDocument()
    expect(screen.queryByText(/twitter/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Retired X unavailable')).not.toBeInTheDocument()
    expect(screen.queryByText('Some trend providers are unavailable')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh trends' }))
    await waitFor(() => expect(getAllTrends).toHaveBeenCalledTimes(2))
    await screen.findByText(trend.title)
    expect(getAllTrends).toHaveBeenLastCalledWith(['google', 'reddit'], segments, expect.objectContaining({ forceRefresh: true }))
    expect(screen.queryByText(retired.title)).not.toBeInTheDocument()
    expect(screen.queryByText(/twitter/i)).not.toBeInTheDocument()
  })

  it('clears prior site results, detail, and update time on a new-context failure', async () => {
    const pending = deferred()
    getAllTrends.mockResolvedValueOnce(success()).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(failures)
    const { rerender } = render(ui(view))
    fireEvent.click(await screen.findByText(trend.title))
    expect(screen.getByTestId('trend-detail')).toBeInTheDocument()
    rerender(ui(view, 'site-b'))
    expect(screen.queryByText(trend.title)).not.toBeInTheDocument()
    expect(screen.queryByTestId('trend-detail')).not.toBeInTheDocument()
    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument()
    await waitFor(() => expect(getAllTrends).toHaveBeenCalledTimes(2))
    await act(async () => pending.resolve(failures))
    expect(screen.getByText('Trends are unavailable')).toBeInTheDocument()
    expect(screen.queryByText(trend.title)).not.toBeInTheDocument()
    // Returning to an earlier context must not resurrect its earlier success.
    rerender(ui(view))
    expect(screen.queryByText(trend.title)).not.toBeInTheDocument()
    await screen.findByText('Trends are unavailable')
  })

  it('ignores older in-flight success after a segment change fails', async () => {
    const old = deferred()
    getAllTrends.mockReturnValueOnce(old.promise).mockResolvedValueOnce(failures)
    const { rerender } = render(ui(view))
    await waitFor(() => expect(getAllTrends).toHaveBeenCalledTimes(1))
    rerender(ui(view, 'site-a', [{ ...segments[0], description: 'Updated audience' }]))
    await screen.findByText('Trends are unavailable')
    await act(async () => old.resolve(success()))
    expect(screen.queryByText(trend.title)).not.toBeInTheDocument()
    expect(screen.getByText('Trends are unavailable')).toBeInTheDocument()
  })

  it('clears successful results after a failed manual refresh or rejected request', async () => {
    getAllTrends.mockResolvedValueOnce(success()).mockRejectedValueOnce(new Error('Network failure'))
    render(ui(view))
    await screen.findByText(trend.title)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh trends' }))
    expect(screen.queryByText(trend.title)).not.toBeInTheDocument()
    await screen.findByText('Unable to load trends')
    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument()
    expect(errorLog).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('keeps the same skeleton while context resolves and the provider request loads', async () => {
    const pending = deferred()
    getAllTrends.mockReturnValue(pending.promise)
    const { container, rerender } = render(ui(view, 'default'))
    const skeletonMarkup = () => Array.from(container.querySelectorAll('.animate-pulse'))
      .map(element => element.outerHTML)
    const initialSkeleton = skeletonMarkup()
    expect(initialSkeleton.length).toBeGreaterThan(0)
    expect(screen.queryByText('Waiting for site context')).not.toBeInTheDocument()
    expect(screen.queryByText(/Trends will load when/)).not.toBeInTheDocument()

    rerender(ui(view, null))
    expect(skeletonMarkup()).toEqual(initialSkeleton)
    rerender(ui(view, 'site-a', segments, false))
    expect(skeletonMarkup()).toEqual(initialSkeleton)
    await act(async () => {})
    expect(getAllTrends).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Refresh trends' })).toBeDisabled()

    rerender(ui(view))
    await waitFor(() => expect(getAllTrends).toHaveBeenCalledTimes(1))
    expect(skeletonMarkup()).toEqual(initialSkeleton)
    expect(screen.queryByText('Waiting for site context')).not.toBeInTheDocument()
    await act(async () => pending.resolve(success()))
    expect(screen.getByText(trend.title)).toBeInTheDocument()
    expect(skeletonMarkup()).toHaveLength(0)
  })

  it('gates missing/default sites and pending context, with stable-value segments avoiding repeats', async () => {
    getAllTrends.mockResolvedValue(success())
    const { rerender } = render(ui(view, 'default'))
    rerender(ui(view, null))
    rerender(ui(view, 'site-a', segments, false))
    await act(async () => {})
    expect(getAllTrends).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Refresh trends' })).toBeDisabled()
    rerender(ui(view))
    await screen.findByText(trend.title)
    rerender(ui(view, 'site-a', segments.map(segment => ({ ...segment }))))
    await act(async () => {})
    expect(getAllTrends).toHaveBeenCalledTimes(1)
  })

  it('treats a successful empty response differently from unavailable providers', async () => {
    getAllTrends.mockResolvedValue(success([]))
    render(ui(view))
    await screen.findByText('No trends available')
    expect(screen.queryByText('Trends are unavailable')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
  })
})