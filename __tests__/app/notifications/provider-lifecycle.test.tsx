import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { NotificationsProvider, useNotifications } from '@/app/notifications/context/NotificationsContext'
import { getNotifications } from '@/app/notifications/actions'
import { useSite } from '@/app/context/SiteContext'
import { useAuth } from '@/app/hooks/use-auth'

jest.mock('@/app/context/SiteContext', () => ({ useSite: jest.fn() }))
jest.mock('@/app/hooks/use-auth', () => ({ useAuth: jest.fn() }))
jest.mock('@/app/notifications/actions', () => ({
  getNotifications: jest.fn(), updateNotification: jest.fn(), markAllAsRead: jest.fn(),
  deleteNotification: jest.fn(), deleteAllNotifications: jest.fn(),
}))

function State() {
  const { notifications, loading } = useNotifications()
  return <span data-testid="state">{loading ? 'loading' : notifications.map(n => n.title).join(',')}</span>
}
const tree = () => <NotificationsProvider><State /></NotificationsProvider>
const site = (id: string) => jest.mocked(useSite).mockReturnValue({ currentSite: { id } } as ReturnType<typeof useSite>)

describe('notification provider lifecycle isolation', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    site('first')
    jest.mocked(useAuth).mockReturnValue({ user: { id: 'user' } } as ReturnType<typeof useAuth>)
  })
  afterEach(() => { jest.useRealTimers() })

  it('aborts in-flight reads on unmount', async () => {
    jest.mocked(getNotifications).mockImplementation(() => new Promise(() => {}))
    const view = render(tree())
    await act(async () => { jest.advanceTimersByTime(1200) })
    const signal = jest.mocked(getNotifications).mock.calls[0][2]!
    expect(signal.aborted).toBe(false)
    view.unmount()
    expect(signal.aborted).toBe(true)
  })
  it('explicitly cancels the read before full-document navigation aborts browser fetch', async () => {
    jest.mocked(getNotifications).mockImplementation(() => new Promise(() => {}))
    const view = render(tree())
    await act(async () => { jest.advanceTimersByTime(1200) })
    const signal = jest.mocked(getNotifications).mock.calls[0][2]!
    window.dispatchEvent(new Event('pagehide'))
    expect(signal.aborted).toBe(true)
    view.unmount()
  })
  it('refreshes with a new signal when restored from the browser back-forward cache', async () => {
    jest.mocked(getNotifications).mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce({ notifications: [] })
    render(tree())
    await act(async () => { jest.advanceTimersByTime(1200) })
    const old = jest.mocked(getNotifications).mock.calls[0][2]!
    window.dispatchEvent(new Event('pagehide'))
    const restore = new Event('pageshow')
    Object.defineProperty(restore, 'persisted', { value: true })
    await act(async () => { window.dispatchEvent(restore) })
    expect(old.aborted).toBe(true)
    expect(jest.mocked(getNotifications).mock.calls[1][2]?.aborted).toBe(false)
    expect(screen.getByTestId('state').textContent).toBe('')
  })

  it('does not restore a previous site response after switching sites', async () => {
    let resolveOld!: (value: Awaited<ReturnType<typeof getNotifications>>) => void
    jest.mocked(getNotifications).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
      .mockResolvedValueOnce({ notifications: [] })
    const view = render(tree())
    await act(async () => { jest.advanceTimersByTime(1200) })
    const signal = jest.mocked(getNotifications).mock.calls[0][2]!
    site('second')
    view.rerender(tree())
    expect(signal.aborted).toBe(true)
    await act(async () => { resolveOld({ notifications: [{ title: 'Stale tenant data' }] as NonNullable<Awaited<ReturnType<typeof getNotifications>>['notifications']> }) })
    expect(screen.queryByText('Stale tenant data')).toBeNull()
    await act(async () => { jest.advanceTimersByTime(1200) })
    expect(jest.mocked(getNotifications).mock.calls[1][0]).toBe('second')
    expect(screen.getByTestId('state').textContent).toBe('')
  })

  it('retains actual read failures rather than converting them to cancelled success', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      jest.mocked(getNotifications).mockResolvedValue({ notifications: [], error: 'Forbidden' })
      render(tree())
      await act(async () => { jest.advanceTimersByTime(1200) })
      expect(warning).toHaveBeenCalledWith('Background notification fetch failed:', 'Forbidden')
      expect(jest.mocked(getNotifications).mock.calls[0][2]?.aborted).toBe(false)
    } finally { warning.mockRestore() }
  })
})