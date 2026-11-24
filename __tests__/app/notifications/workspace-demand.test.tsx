import { act, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { NotificationBadge } from '@/app/components/navigation/NotificationBadge'
import { NotificationsProvider } from '@/app/notifications/context/NotificationsContext'
import { getNotifications, getUnreadNotificationCount } from '@/app/notifications/actions'
import type { Notification } from '@/app/notifications/types'

let mockActor = 'alice', mockTargetActor = 'alice', mockLoading = false
let mockPermission: 'ready' | 'loading' | 'denied' = 'ready'
const mockRead = { status: 'ready' }
jest.mock('@/app/context/WorkspaceAccessSnapshot', () => ({ useWorkspaceAccessSnapshot: () => ({
  actor: mockActor, siteId: 'site', read: mockPermission === 'ready' ? mockRead : undefined }) }))
jest.mock('@/app/context/ScreenAccessContext', () => ({ useOptionalScreenAccess: () => ({ screenScopeStatus: mockPermission,
  verifiedWorkspaceLists: mockPermission === 'ready' ? { actorId: mockActor, siteId: 'site' } : undefined }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'site' },
  requestScope: { siteId: 'site', actorId: mockTargetActor }, isLoading: mockLoading }) }))
jest.mock('@/app/hooks/use-auth', () => ({ useAuth: () => ({ user: { id: mockActor }, isLoading: false }) }))
jest.mock('@/app/notifications/actions', () => ({ getNotifications: jest.fn(), getUnreadNotificationCount: jest.fn() }))

const tree = (inbox: boolean, badge: boolean) => <NotificationsProvider active={inbox}>
  {badge && <NotificationBadge isActive={inbox} />}
</NotificationsProvider>

beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks()
  mockActor = mockTargetActor = 'alice'; mockLoading = false; mockPermission = 'ready'
  jest.mocked(getNotifications).mockResolvedValue({ notifications: [{ is_read: false }] as Notification[] })
  jest.mocked(getUnreadNotificationCount).mockResolvedValue(9)
})
afterEach(() => jest.useRealTimers())

it('keeps the workspace shell mounted when the inbox reader starts, changes scope, or stops', async () => {
  const mount = jest.fn(), cleanup = jest.fn()
  function Shell() { useEffect(() => { mount(); return cleanup }, []); return null }
  const shell = (active: boolean) => <NotificationsProvider active={active}><Shell /></NotificationsProvider>
  const view = render(shell(false))
  view.rerender(shell(true)); await act(async () => {})
  mockActor = mockTargetActor = 'bob'; view.rerender(shell(true)); await act(async () => {})
  view.rerender(shell(false))
  expect(mount).toHaveBeenCalledTimes(1); expect(cleanup).not.toHaveBeenCalled()
  expect(getNotifications).toHaveBeenCalledTimes(2)
})

it('does no notification work without a badge or inbox, then defers only the visible badge projection', async () => {
  const v = render(tree(false, false))
  await act(async () => jest.advanceTimersByTime(5000))
  expect(getNotifications).not.toHaveBeenCalled(); expect(getUnreadNotificationCount).not.toHaveBeenCalled()
  mockLoading = true; v.rerender(tree(false, true))
  await act(async () => jest.advanceTimersByTime(5000))
  expect(getUnreadNotificationCount).not.toHaveBeenCalled()
  mockLoading = false; v.rerender(tree(false, true))
  expect(getUnreadNotificationCount).not.toHaveBeenCalled()
  await act(async () => jest.advanceTimersByTime(1200))
  expect(getUnreadNotificationCount).toHaveBeenCalledTimes(1)
  expect(screen.getByText('9')).toBeVisible(); expect(getNotifications).not.toHaveBeenCalled()
  v.rerender(tree(true, true))
  // The inbox does not inherit the badge's wait or fetch the count a second time.
  await act(async () => {})
  expect(getNotifications).toHaveBeenCalledTimes(1); expect(screen.getByText('1')).toBeVisible()
  expect(getUnreadNotificationCount).toHaveBeenCalledTimes(1)
})

it('rejects late count data on a same-site account change even if the transport ignores abort', async () => {
  let finish!: (value: number) => void
  jest.mocked(getUnreadNotificationCount).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const v = render(tree(false, true))
  await act(async () => jest.advanceTimersByTime(1200))
  const signal = jest.mocked(getUnreadNotificationCount).mock.calls[0][2]
  mockActor = 'bob'; v.rerender(tree(false, true))
  expect(signal.aborted).toBe(true)
  await act(async () => finish(42))
  expect(screen.queryByText('42')).toBeNull()
  await act(async () => jest.advanceTimersByTime(5000))
  expect(getUnreadNotificationCount).toHaveBeenCalledTimes(1)
  mockTargetActor = 'bob'; v.rerender(tree(false, true))
  await act(async () => jest.advanceTimersByTime(1200))
  expect(getUnreadNotificationCount).toHaveBeenLastCalledWith('site', 'bob', expect.any(AbortSignal))
})

it('hides previously read rows/counts immediately when screen proof is invalidated at the same site', async () => {
  const view = render(tree(true, true))
  await act(async () => {})
  expect(screen.getByText('1')).toBeVisible()
  mockPermission = 'loading'; view.rerender(tree(true, true))
  expect(screen.queryByText('1')).toBeNull()
  mockPermission = 'denied'; view.rerender(tree(false, true))
  await act(async () => jest.advanceTimersByTime(5000))
  expect(getNotifications).toHaveBeenCalledTimes(1)
  expect(getUnreadNotificationCount).not.toHaveBeenCalled()
})