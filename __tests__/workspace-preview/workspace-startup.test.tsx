import { StrictMode, useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { AuthContext, type AuthContextValue } from '@/app/components/auth/auth-context'
import { WorkspaceStartupBoundary, WorkspaceStartupContent, useWorkspaceStartup, PREVIEW_DELAY_MS } from '@/app/workspace-preview/WorkspaceStartupBoundary'
import { directoryPreview } from '@/app/workspace-preview/loaders/directories'
import { WorkspacePreviewError, type WorkspacePreviewInput } from '@/app/workspace-preview/types'

jest.mock('@/app/context/SiteContext', () => ({ useSite: () => mockSite }))
jest.mock('@/app/context/ScreenAccessContext', () => ({ useOptionalScreenAccess: () => mockAccess }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock('@/app/workspace-preview/loaders/directories', () => ({ directoryPreview: jest.fn() }))
const mockSite = { requestScope: { actorId: 'actor', siteId: 'site' }, currentSite: { id: 'site' } as { id: string } | null,
  error: null as Error | null, isLoading: true, sitesLoaded: true, refreshSites: jest.fn(), sites: [{ id: 'site' }] }
const mockAccess = { verifiedWorkspaceLists: { actorId: 'actor', siteId: 'site' } as { actorId: string; siteId: string } | undefined,
  canAccessNavKey: jest.fn(), isReady: true, screenScopeStatus: 'ready', legacyWorkspaceListsAllowed: false, retryScreenScope: jest.fn() }
const mockRead = jest.mocked(directoryPreview)
function Toolbar() { return useWorkspaceStartup() ? null : <button>Edit</button> }
function ActualPage() { const [count, set] = useState(0); return <button onClick={() => set(count + 1)}>Full page {count}</button> }
function ui(path = '/assets', actor = 'actor', query = '') {
  return <StrictMode><AuthContext.Provider value={{ user: { id: actor }, isLoading: false } as AuthContextValue}>
    <WorkspaceStartupBoundary pathname={path} search={query}><Toolbar /><WorkspaceStartupContent><ActualPage /></WorkspaceStartupContent></WorkspaceStartupBoundary>
  </AuthContext.Provider></StrictMode>
}
const advance = (ms: number) => act(async () => { jest.advanceTimersByTime(ms) })
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); mockRead.mockReset().mockResolvedValue([{ id: 'row', label: 'Example' }]); localStorage.clear()
  Object.assign(mockSite, { currentSite: { id: 'site', settings_read_status: 'loaded' }, requestScope: { siteId: 'site', actorId: 'actor' }, isLoading: true, error: null })
  Object.assign(mockAccess, { verifiedWorkspaceLists: mockSite.requestScope, isReady: true, screenScopeStatus: 'ready', legacyWorkspaceListsAllowed: false })
  mockAccess.canAccessNavKey.mockImplementation(() => true)
})
afterEach(() => jest.useRealTimers())
it('renders only skeletons while checking access and awaiting a verified read', async () => {
  mockRead.mockReturnValue(new Promise(() => {}))
  mockAccess.screenScopeStatus = 'loading'; mockAccess.verifiedWorkspaceLists = undefined
  const view = render(ui())
  const expectSkeleton = () => {
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(view.container.querySelector('.animate-pulse')).not.toBeNull()
    expect(view.container.textContent).toBe('')
  }
  expectSkeleton(); expect(mockRead).not.toHaveBeenCalled()
  mockAccess.screenScopeStatus = 'ready'; mockAccess.verifiedWorkspaceLists = mockSite.requestScope
  view.rerender(ui()); expectSkeleton(); await advance(PREVIEW_DELAY_MS); expectSkeleton()
  expect(mockRead).toHaveBeenCalledTimes(1)
})
it('does not turn a provisional identity into interactive content just because another operation finished', async () => {
  mockSite.currentSite = { id: 'site' }; mockSite.isLoading = false
  const view = render(ui()); await advance(PREVIEW_DELAY_MS)
  expect(screen.queryByText('Edit')).toBeNull(); expect(screen.queryByText('Full page 0')).toBeNull()
  Object.assign(mockSite.currentSite!, { settings_read_status: 'missing' })
  view.rerender(ui()); expect(screen.getByText('Edit')).toBeVisible()
})
it('uses zero optional reads on fast hydration and keeps an already interactive screen mounted on same-scope rerenders', async () => {
  const view = render(ui()); expect(screen.queryByRole('button')).toBeNull()
  await advance(100); mockSite.isLoading = false; view.rerender(ui()); await advance(400)
  expect(mockRead).not.toHaveBeenCalled(); fireEvent.click(screen.getByText('Full page 0')); view.rerender(ui())
  expect(screen.getByText('Full page 1')).toBeVisible()
})
it('does not mount the normal screen/toolbar from a cached target; a verified slow read displays only inert rows', async () => {
  const view = render(ui()); await advance(PREVIEW_DELAY_MS); expect(mockRead).toHaveBeenCalledTimes(1)
  expect(screen.getByText('Example')).toBeVisible(); expect(screen.queryByRole('button')).toBeNull()
  mockSite.isLoading = false; mockSite.currentSite = null; mockSite.error = new Error('settings timed out'); view.rerender(ui())
  expect(screen.getByText('Example')).toBeVisible(); fireEvent.click(screen.getByText('common.retry'))
  expect(mockSite.refreshSites).toHaveBeenCalledTimes(1); expect(mockRead).toHaveBeenCalledTimes(1)
})
it.each(['loading','legacy','denied','unavailable','restricted','blocked','foreignActor','foreignSite','noActor'])('never starts an early read for %s', async kind => {
  if (['loading','legacy','denied','unavailable','restricted'].includes(kind)) mockAccess.verifiedWorkspaceLists = undefined
  if (kind === 'blocked') mockAccess.canAccessNavKey.mockImplementation((key: string) => key !== 'assets')
  if (kind === 'foreignSite') mockSite.currentSite = { id: 'other' }
  if (['loading','legacy','denied','unavailable'].includes(kind)) mockAccess.screenScopeStatus = kind
  render(ui('/assets', kind === 'foreignActor' ? 'another' : kind === 'noActor' ? '' : 'actor')); await advance(6_000)
  expect(mockRead).not.toHaveBeenCalled(); expect(screen.queryByText('Edit')).toBeNull()
})
it.each(['change-route','change-actor','change-site','revoke','hydrate'])('aborts a pending projection on %s and discards a late success', async reason => {
  let resolve!: (v: {id: string; label: string}[]) => void; let input!: WorkspacePreviewInput
  mockRead.mockImplementationOnce((_screen, i) => { input = i; return new Promise(done => { resolve = done }) })
  const view = render(ui()); await advance(PREVIEW_DELAY_MS)
  if (reason === 'revoke') mockAccess.canAccessNavKey.mockReturnValue(false)
  if (reason === 'hydrate') mockSite.isLoading = false
  if (reason === 'change-site') {
    mockSite.currentSite = { id: 'new' }; mockSite.requestScope = { actorId: 'actor', siteId: 'new' }
    mockAccess.verifiedWorkspaceLists = mockSite.requestScope
  }
  view.rerender(ui(reason === 'change-route' ? '/segments' : '/assets', reason === 'change-actor' ? 'new' : 'actor'))
  expect(input.signal.aborted).toBe(true); await act(async () => resolve([{ id: 'stale', label: 'Prior account' }]))
  expect(screen.queryByText('Prior account')).toBeNull()
})
it('does not retry on a timer and distinguishes denial, outage and a confirmed empty result', async () => {
  mockRead.mockRejectedValueOnce(new WorkspacePreviewError()).mockResolvedValueOnce([])
  const view = render(ui()); await advance(PREVIEW_DELAY_MS); await advance(60_000)
  expect(screen.getByText('workspacePreview.failed')).toBeVisible(); expect(mockRead).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByText('common.retry')); await advance(PREVIEW_DELAY_MS); expect(screen.getByText('workspacePreview.empty')).toBeVisible()
  mockRead.mockRejectedValueOnce(new WorkspacePreviewError(true)); view.rerender(ui('/segments')); await advance(PREVIEW_DELAY_MS)
  expect(screen.getByText('workspacePreview.denied')).toBeVisible(); expect(screen.queryByRole('button')).toBeNull()
})

it('keeps legacy startup gated until both the old site list and capability verify access', async () => {
  mockAccess.screenScopeStatus = 'legacy'; mockAccess.verifiedWorkspaceLists = undefined
  const view = render(ui()); await advance(500); expect(mockRead).not.toHaveBeenCalled(); expect(screen.queryByText('Edit')).toBeNull()
  mockSite.isLoading = false; view.rerender(ui()); expect(screen.queryByText('Edit')).toBeNull()
  expect(screen.getByText('workspacePreview.failed')).toBeVisible()
  mockSite.sitesLoaded = false; view.rerender(ui())
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  mockSite.sitesLoaded = true
  mockAccess.legacyWorkspaceListsAllowed = true; view.rerender(ui()); expect(screen.getByText('Edit')).toBeVisible()
})

it('offers reload while cancellation is stalled, then enables an explicit fresh retry without publishing late rows', async () => {
  let resolve!: (rows: { id: string; label: string }[]) => void
  mockRead.mockReturnValueOnce(new Promise(done => { resolve = done }))
  render(ui()); await advance(500); await advance(5_000)
  expect(screen.getByRole('status')).toHaveTextContent('workspacePreview.stalled')
  expect(screen.queryByText('common.retry')).toBeNull()
  const originalLocation = window.location, reload = jest.fn()
  Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } })
  try {
    fireEvent.click(screen.getByRole('button', { name: 'workspacePreview.reload' }))
    expect(reload).toHaveBeenCalledTimes(1)
  } finally { Object.defineProperty(window, 'location', { configurable: true, value: originalLocation }) }
  await advance(60_000); expect(mockRead).toHaveBeenCalledTimes(1); expect(mockSite.refreshSites).not.toHaveBeenCalled()
  await act(async () => resolve([{ id: 'late', label: 'Ignore' }]))
  expect(screen.queryByText('Ignore')).toBeNull()
  expect(screen.getByRole('button', { name: 'workspacePreview.reload' })).toBeVisible()
  fireEvent.click(screen.getByText('common.retry')); await advance(500); expect(mockRead).toHaveBeenCalledTimes(2)
  expect(screen.getByText('Example')).toBeVisible(); expect(screen.queryByText('Edit')).toBeNull()
})