/** @jest-environment node */
import { getNotifications, getUnreadNotificationCount } from '@/app/notifications/actions'

describe('notification read cancellation', () => {
  let error: jest.SpyInstance
  beforeEach(() => {
    jest.mocked(fetch).mockReset()
    error = jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => { error.mockRestore() })
  it('cancels only explicitly aborted caller reads without logging false failures', async () => {
    const controller = new AbortController()
    controller.abort()
    jest.mocked(fetch).mockRejectedValue(new DOMException('Cancelled', 'AbortError'))
    await expect(getNotifications('site', 'user', controller.signal)).resolves.toEqual({ notifications: null, cancelled: true })
    expect(jest.mocked(fetch).mock.calls[0][1]?.signal).toBe(controller.signal)
    expect(error).not.toHaveBeenCalled()
  })
  it('does not treat an unrequested transport failure as cancellation or success', async () => {
    jest.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(getNotifications('site', 'user')).resolves.toMatchObject({ error: 'Failed to fetch' })
    expect(error).toHaveBeenCalled()
  })
  it.each([401, 403])('preserves successful data and HTTP %i authorization denial', async status => {
    jest.mocked(fetch).mockResolvedValueOnce(Response.json({ notifications: [] }))
    await expect(getNotifications('site', 'user')).resolves.toEqual({ notifications: [] })
    jest.mocked(fetch).mockResolvedValueOnce(Response.json({ error: 'Forbidden' }, { status }))
    await expect(getNotifications('site', 'user')).resolves.toMatchObject({ error: 'Forbidden', denied: true })
  })
  it('does not log a body-reading error after the caller aborts the read', async () => {
    const controller = new AbortController()
    jest.mocked(fetch).mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => { controller.abort(); throw new DOMException('Cancelled', 'AbortError') },
    } as unknown as Response)
    await expect(getNotifications('site', 'user', controller.signal)).resolves.toEqual({ notifications: null, cancelled: true })
    expect(error).not.toHaveBeenCalled()
  })
  it('does not publish a mismatched inbox or accept a list response as a badge count', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(Response.json({ notifications: [{ site_id: 'other', user_id: 'user' }] }))
    await expect(getNotifications('site', 'user')).resolves.toMatchObject({ notifications: [], error: expect.any(String) })
    jest.mocked(fetch).mockResolvedValueOnce(Response.json({ notifications: [] }))
    await expect(getUnreadNotificationCount('site', 'user', new AbortController().signal)).rejects.toThrow('Invalid notification count')
  })
})