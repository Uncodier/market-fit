/** @jest-environment node */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readNotifications } from '@/app/api/notifications/read'
import { requireSiteAccess } from '@/lib/auth/api-site-access'

jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))
const site = '00000000-0000-4000-8000-000000000001', actor = '00000000-0000-4000-8000-000000000002'
const url = (query: string) => new Request(`https://workspace.test/api/notifications?${query}`, { headers: { cookie: 'session=test' } })
function authorize(data: object[]) {
  const urls: URL[] = []
  const supabase = createClient('https://local-only.example.test', 'unused-test-key', { auth: { persistSession: false },
    global: { fetch: async input => { urls.push(new URL(String(input))); return Response.json(data) } } })
  jest.mocked(requireSiteAccess).mockResolvedValue({ role: 'collaborator', userEmail: null, userId: actor, supabase } as never)
  return urls
}
beforeEach(() => jest.clearAllMocks())

it.each([true, false])('derives the recipient from the verified user; keeps the same window for badge and inbox (badge=%s)', async badge => {
  const rows = [{ is_read: false, title: 'Private message' }, { is_read: true }]
  const requests = authorize(rows)
  const request = url(`site_id=${site}${badge ? '&view=unread' : ''}`)
  const response = await readNotifications(request)
  expect(requireSiteAccess).toHaveBeenCalledWith(request, site)
  expect(requests).toHaveLength(1)
  expect(Object.fromEntries(requests[0].searchParams)).toMatchObject({
    select: badge ? 'is_read' : '*', site_id: `eq.${site}`, user_id: `eq.${actor}`, order: 'created_at.desc,id.desc', limit: '1000',
  })
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(await response.json()).toEqual(badge ? { unreadCount: 1 } : { notifications: rows })
})
it.each([401, 403, 503])('preserves authentication, membership/location denials and unavailability (%i)', async status => {
  jest.mocked(requireSiteAccess).mockResolvedValue({ error: NextResponse.json({ error: 'Unavailable' }, { status }) })
  expect((await readNotifications(url(`site_id=${site}&view=unread`))).status).toBe(status)
})
it('never returns another recipient from a client override', async () => {
  const requests = authorize([])
  expect((await readNotifications(url(`site_id=${site}&user_id=${site}`))).status).toBe(403)
  expect(requests).toEqual([])
})
it.each(['', 'site_id=not-a-site', `site_id=${site}&view=wrong`, `site_id=${site}&site_id=${site}`])('rejects invalid query: %s', async query => {
  expect((await readNotifications(url(query))).status).toBe(400)
  expect(requireSiteAccess).not.toHaveBeenCalled()
})