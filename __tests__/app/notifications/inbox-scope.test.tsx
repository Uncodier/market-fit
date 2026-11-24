import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import NotificationsPage from '@/app/notifications/page'
import { NotificationsProvider } from '@/app/notifications/context/NotificationsContext'
import { getNotifications, getUnreadNotificationCount } from '@/app/notifications/actions'
import { NotificationBadge } from '@/app/components/navigation/NotificationBadge'

const mockRetryScope = jest.fn(), mockRefreshSites = jest.fn()
const initial = () => ({
  auth: { isLoading: false, user: { id: 'alice', is_anonymous: false } },
  site: { currentSite: { id: 'one' } as { id: string } | null, error: null as Error | null, isLoading: false,
    requestScope: { siteId: 'one', actorId: 'alice' } as { siteId: string; actorId: string } | null, refreshSites: mockRefreshSites },
  access: { screenScopeStatus: 'ready', verifiedWorkspaceLists: { siteId: 'one', actorId: 'alice' } as object | undefined,
    legacyWorkspaceListsAllowed: false, retryScreenScope: mockRetryScope },
})
let mockState: ReturnType<typeof initial>
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => mockState.site }))
jest.mock('@/app/hooks/use-auth', () => ({ useAuth: () => mockState.auth }))
jest.mock('@/app/context/ScreenAccessContext', () => ({ useOptionalScreenAccess: () => mockState.access }))
jest.mock('@/app/context/PermissionContext', () => ({ useOptionalPermissions: () => null }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock('@/app/components/ui/sticky-header', () => ({ StickyHeader: ({ children }: { children: ReactNode }) => <header>{children}</header> }))
jest.mock('@/app/notifications/actions', () => ({ getNotifications: jest.fn(), getUnreadNotificationCount: jest.fn() }))

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
  mockState.access.screenScopeStatus = 'legacy'; mockState.access.legacyWorkspaceListsAllowed = true
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