import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import NotificationsPage from '@/app/notifications/page'
import { NotificationsProvider, useNotifications } from '@/app/notifications/context/NotificationsContext'
import { getNotifications, getUnreadNotificationCount, markAllAsRead, deleteAllNotifications, updateNotification, deleteNotification } from '@/app/notifications/actions'
import { NotificationBadge } from '@/app/components/navigation/NotificationBadge'

const mockRetryScope = jest.fn(), mockRefreshSites = jest.fn()
const initial = () => ({
  read: { status: 'ready' },
  auth: { isLoading: false, user: { id: 'alice', is_anonymous: false } },
  site: { currentSite: { id: 'one' } as { id: string } | null, error: null as Error | null, isLoading: false, workspaceAccessLost: false,
    requestScope: { siteId: 'one', actorId: 'alice' } as { siteId: string; actorId: string } | null, refreshSites: mockRefreshSites },
  access: { screenScopeStatus: 'ready', verifiedWorkspaceLists: { siteId: 'one', actorId: 'alice' } as object | undefined,
    legacyWorkspaceListsAllowed: false, retryScreenScope: mockRetryScope },
})
let mockState: ReturnType<typeof initial>
jest.mock('@/app/context/WorkspaceAccessSnapshot', () => ({ useWorkspaceAccessSnapshot: () => ({
  actor: mockState.auth.user.id, siteId: mockState.site.requestScope?.siteId, read: mockState.read }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => mockState.site }))
jest.mock('@/app/hooks/use-auth', () => ({ useAuth: () => mockState.auth }))
jest.mock('@/app/context/ScreenAccessContext', () => ({ useOptionalScreenAccess: () => mockState.access }))
jest.mock('@/app/context/PermissionContext', () => ({ useOptionalPermissions: () => null }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock('@/app/components/ui/sticky-header', () => ({ StickyHeader: ({ children }: { children: ReactNode }) => <header>{children}</header> }))
jest.mock('@/app/notifications/actions', () => ({ getNotifications: jest.fn(), getUnreadNotificationCount: jest.fn(),
  updateNotification: jest.fn(), deleteNotification: jest.fn(), markAllAsRead: jest.fn(), deleteAllNotifications: jest.fn() }))

const page = () => <NotificationsProvider active><NotificationsPage /></NotificationsProvider>
const badge = () => <NotificationsProvider active={false}><NotificationBadge /></NotificationsProvider>
const unknown = () => {
  expect(screen.queryByText('notifications.empty.title')).toBeNull()
  expect(screen.queryByText(/\d+ unread ·|\d+ results/)).toBeNull()
  expect(within(screen.getByRole('tab', { name: /notifications.tabs.unread/ })).queryByText(/^\d+$/)).toBeNull()
  expect(screen.getByRole('button', { name: 'notifications.deleteAll' })).toBeDisabled()
}
function expectSilentLoading(container: HTMLElement) {
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  expect(container.querySelector('.animate-pulse')).not.toBeNull()
  expect(container.textContent).toBe('')
  expect(screen.queryByRole('button')).toBeNull()
}
beforeEach(() => {
  jest.resetAllMocks(); mockState = initial(); jest.useFakeTimers()
  jest.mocked(getNotifications).mockResolvedValue({ notifications: [] })
  jest.mocked(getUnreadNotificationCount).mockResolvedValue(0)
})
afterEach(() => jest.useRealTimers())

it.each<[string, () => void, string | null]>([
  ['auth loading', () => { mockState.auth.isLoading = true }, null],
  ['settings loading', () => { mockState.site.isLoading = true }, null],
  ['selection hydrating', () => { mockState.site.currentSite = null }, null],
  ['actor changed', () => { mockState.auth.user.id = 'bob' }, null],
  ['site changed', () => { mockState.site.currentSite = { id: 'two' } }, null],
  ['verification loading', () => { mockState.access.screenScopeStatus = 'loading' }, null],
  ['no selection', () => { mockState.site.currentSite = mockState.site.requestScope = null }, 'noSiteSelected'],
  ['demo', () => { mockState.site.currentSite = { id: 'demo-one' } }, 'workspacePreview.denied'],
  ['anonymous', () => { mockState.auth.user.is_anonymous = true }, 'workspacePreview.denied'],
  ['denied', () => { mockState.access.screenScopeStatus = 'denied' }, 'workspacePreview.denied'],
  ['location restricted', () => { mockState.access.verifiedWorkspaceLists = undefined }, 'workspacePreview.denied'],
  ['mismatched proof', () => { mockState.access.verifiedWorkspaceLists = { actorId: 'bob', siteId: 'one' } }, 'chat.workspace.unavailable'],
  ['unconfirmed legacy', () => { mockState.access.screenScopeStatus = 'legacy' }, 'chat.workspace.unavailable'],
])('does not publish an empty inbox or start any reads for %s', async (_, configure, message) => {
  configure()
  const view = render(page())
  if (message) { expect(screen.getByText(message)).toBeVisible(); unknown() }
  else expectSilentLoading(view.container)
  if (message !== 'chat.workspace.unavailable') expect(screen.queryByText('common.retry')).toBeNull()
  view.rerender(badge()); await act(async () => jest.advanceTimersByTime(5000))
  expect(getNotifications).not.toHaveBeenCalled(); expect(getUnreadNotificationCount).not.toHaveBeenCalled()
})

it.each(['settings', 'verification'])('retries the failed %s check, not the inbox, until authorization settles', async failure => {
  if (failure === 'settings') { mockState.site.currentSite = null; mockState.site.error = Error('failed') }
  else mockState.access.screenScopeStatus = 'unavailable'
  const view = render(page()); unknown()
  expect(screen.getByText(failure === 'settings' ? 'notifications.settingsUnavailable' : 'chat.workspace.unavailable')).toBeVisible()
  fireEvent.click(screen.getByText('common.retry'))
  if (failure === 'settings') {
    expect(mockRefreshSites).toHaveBeenCalledWith({ recoverMissingList: true }); expect(mockRetryScope).not.toHaveBeenCalled()
  } else { expect(mockRetryScope).toHaveBeenCalledTimes(1); expect(mockRefreshSites).not.toHaveBeenCalled() }
  expect(getNotifications).not.toHaveBeenCalled()

  mockState = initial()
  mockState.read.status = mockState.access.screenScopeStatus = 'legacy'; mockState.access.legacyWorkspaceListsAllowed = true
  view.rerender(page()); expectSilentLoading(view.container)
  await act(async () => {})
  expect(getNotifications).toHaveBeenCalledTimes(1)
  expect(screen.getByText('notifications.empty.title')).toBeVisible(); expect(screen.getByText('0 unread · 0 total')).toBeVisible()
})

it('retries a list failure against the verified scope and respects backend denial', async () => {
  jest.mocked(getNotifications).mockResolvedValueOnce({ error: 'Unavailable', notifications: null })
    .mockResolvedValueOnce({ denied: true, error: 'Forbidden', notifications: null })
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    render(page()); await act(async () => {}); unknown()
    expect(screen.getByText('Notifications could not be loaded.')).toBeVisible()
    await act(async () => { fireEvent.click(screen.getByText('common.retry')) }); unknown()
    expect(screen.getByText('workspacePreview.denied')).toBeVisible(); expect(screen.queryByText('common.retry')).toBeNull()
    expect(getNotifications).toHaveBeenCalledTimes(2); expect(mockRetryScope).not.toHaveBeenCalled()
    expect(mockRefreshSites).not.toHaveBeenCalled()
  } finally { warn.mockRestore() }
})

it.each([false, true])('keeps a verified empty inbox until the server denies it (settings paused: %s)', async paused => {
  let finish!: (result: Awaited<ReturnType<typeof getNotifications>>) => void
  jest.mocked(getNotifications).mockResolvedValueOnce({ notifications: [] })
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const view = render(page()); await act(async () => {})
    const restore = new Event('pageshow'); Object.defineProperty(restore, 'persisted', { value: true })
    await act(async () => { window.dispatchEvent(restore) })
    expect(getNotifications).toHaveBeenCalledTimes(2)
    mockState.site.isLoading = paused; view.rerender(page())
    expect(screen.getByText('notifications.empty.title')).toBeVisible()
    await act(async () => finish({ denied: true, error: 'Forbidden', notifications: null }))
    expect(screen.queryByText('notifications.empty.title')).toBeNull()
    expect(screen.getByText('workspacePreview.denied')).toBeVisible()
  } finally { warn.mockRestore() }
})
const row = { id: 'n1', title: 'Private update', message: 'Opened in this workspace', type: 'info', is_read: false,
  site_id: 'one', user_id: 'alice', created_at: '2026-11-16T09:00:00Z', updated_at: '2026-11-16T09:00:00Z' }

it('does not admit a first inbox response that arrives during a settings pause', async () => {
  let finish!: (result: Awaited<ReturnType<typeof getNotifications>>) => void
  jest.mocked(getNotifications).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(page()); mockState.site.isLoading = true; view.rerender(page())
  await act(async () => finish({ notifications: [row] })); expectSilentLoading(view.container)
  expect(getNotifications).toHaveBeenCalledTimes(1)
  mockState.site.isLoading = false; view.rerender(page()); await act(async () => {})
  expect(screen.getByText('notifications.empty.title')).toBeVisible(); expect(getNotifications).toHaveBeenCalledTimes(2)
})

it('keeps admitted rows read-only during settings sync, including previously captured callbacks', async () => {
  let inbox!: ReturnType<typeof useNotifications>
  function Capture() { inbox = useNotifications(); return null }
  const tree = () => <NotificationsProvider active><Capture /><NotificationsPage /></NotificationsProvider>
  jest.mocked(getNotifications).mockResolvedValue({ notifications: [row] })
  const view = render(tree()); await act(async () => {})
  const previous = inbox
  expect(screen.getByRole('button', { name: 'Mark as read' })).toBeEnabled()
  mockState.site.isLoading = true; view.rerender(tree())
  expect(screen.getByText(row.title)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Mark as read' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'notifications.deleteAll' })).toBeDisabled()
  // A shared selector/billing error is not evidence of an inbox access change.
  mockState.site.error = Error('Background billing failed'); view.rerender(tree())
  expect(screen.getByText(row.title)).toBeVisible(); expect(inbox.status).toBe('paused')
  await act(async () => {
    for (const state of [previous, inbox]) {
      await state.refreshNotifications(); await state.markAsRead(row.id); await state.deleteOneNotification(row.id)
      await state.markAllNotificationsAsRead(); await state.deleteAllUserNotifications()
    }
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    jest.advanceTimersByTime(5000)
  })
  expect(getNotifications).toHaveBeenCalledTimes(1)
  for (const action of [updateNotification, markAllAsRead, deleteNotification, deleteAllNotifications]) expect(action).not.toHaveBeenCalled()
  mockState.site.isLoading = false; view.rerender(tree()); await act(async () => {})
  expect(getNotifications).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('button', { name: 'Mark as read' })).toBeEnabled()
})

it.each<[string, () => void]>([
  ['actor change', () => { mockState.auth.user.id = 'bob' }],
  ['site change', () => { mockState.site.currentSite = { id: 'two' } }],
  ['missing selection', () => { mockState.site.currentSite = null }],
  ['fresh equivalent proof', () => { mockState.read = { ...mockState.read } }],
  ['proof invalidation', () => { mockState.access.screenScopeStatus = 'loading' }],
  ['denied proof', () => { mockState.access.screenScopeStatus = 'denied' }],
  ['revoked workspace', () => { mockState.site.workspaceAccessLost = true }],
])('retires the paused result on %s', async (_, revoke) => {
  jest.mocked(getNotifications).mockResolvedValue({ notifications: [row] })
  const view = render(page()); await act(async () => {})
  mockState.site.isLoading = true; view.rerender(page()); expect(screen.getByText(row.title)).toBeVisible()
  revoke(); view.rerender(page()); expect(screen.queryByText(row.title)).toBeNull()
  expect(getNotifications).toHaveBeenCalledTimes(1)
})

it('retains the last result after a transient failure during pause and revalidates on resume', async () => {
  let finish!: (result: Awaited<ReturnType<typeof getNotifications>>) => void
  jest.mocked(getNotifications).mockResolvedValueOnce({ notifications: [row] })
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = render(page()); await act(async () => {})
  await act(async () => { window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })) })
  mockState.site.isLoading = true; view.rerender(page())
  await act(async () => finish({ error: 'Unavailable', notifications: null }))
  expect(screen.getByText(row.title)).toBeVisible(); expect(getNotifications).toHaveBeenCalledTimes(2)
  mockState.site.isLoading = false; view.rerender(page()); await act(async () => {})
  expect(getNotifications).toHaveBeenCalledTimes(3); expect(screen.queryByText(row.title)).toBeNull()
  expect(screen.getByText('notifications.empty.title')).toBeVisible()
})

it('leaving the route during settings sync retires the admitted result and cannot activate an off-route inbox', async () => {
  jest.mocked(getNotifications).mockResolvedValue({ notifications: [row] })
  const view = render(page()); await act(async () => {})
  mockState.site.isLoading = true; view.rerender(page()); expect(screen.getByText(row.title)).toBeVisible()
  view.rerender(badge()); view.rerender(page()); expectSilentLoading(view.container)
  view.rerender(badge()); mockState.site.isLoading = false; view.rerender(badge())
  await act(async () => jest.advanceTimersByTime(2000)); expect(getNotifications).toHaveBeenCalledTimes(1)
})
