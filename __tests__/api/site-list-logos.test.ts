/** @jest-environment node */
import { createClient } from '@supabase/supabase-js'
import { POST } from '@/app/api/sites/logos/route'
import { createUserSupabase } from '@/lib/auth/site-member-request'

jest.mock('@/lib/auth/site-member-request', () => ({ createUserSupabase: jest.fn() }))
const actor = '00000000-0000-4000-8000-000000000011'
const owned = '00000000-0000-4000-8000-000000000001', member = '00000000-0000-4000-8000-000000000002'
const foreign = '00000000-0000-4000-8000-000000000003'
const call = (body: unknown) => POST(new Request('https://workspace.test/api/sites/logos', { method: 'POST', body: JSON.stringify(body) }))

function fixture(location: unknown = false, user: { id: string; is_anonymous?: boolean } | null = { id: actor }, failure?: string) {
  const urls: URL[] = []
  const sdk = createClient('https://local-only.example.test', 'test-public-key', { auth: { persistSession: false },
    global: { fetch: async input => {
      const url = new URL(String(input)); urls.push(url)
      const resource = url.pathname.split('/').pop()
      if (resource === failure) return Response.json({ message: 'private db diagnostic' }, { status: 500 })
      const body = resource === 'current_user_has_location_restrictions' ? location : resource === 'site_members'
        ? [{ site_id: member }] : resource === 'sites' ? [{ id: owned, logo_url: 'mine' }, { id: member, logo_url: 'shared' }] : null
      return Response.json(body)
    } },
  })
  const auth = jest.fn(async () => ({ data: { user }, error: null }))
  jest.mocked(createUserSupabase).mockResolvedValue({ auth: { getUser: auth }, from: sdk.from.bind(sdk), rpc: sdk.rpc.bind(sdk) } as never)
  return { urls, auth }
}
beforeEach(() => jest.clearAllMocks())

it('performs one Auth check and reads only the requested unarchived, owned or enabled-member rows with the user client', async () => {
  const { urls, auth } = fixture()
  const response = await call({ ids: [owned, member, foreign, member] })
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(await response.json()).toEqual({ success: true, actorId: actor, logos: { [owned]: 'mine', [member]: 'shared' } })
  expect(auth).toHaveBeenCalledTimes(1)
  expect(urls.map(url => url.pathname.split('/').pop())).toEqual(['current_user_has_location_restrictions', 'site_members', 'sites'])
  expect(Object.fromEntries(urls[1].searchParams)).toMatchObject({
    select: 'site_id', user_id: `eq.${actor}`, status: 'eq.active', license_suspended: 'eq.false', site_id: `in.(${owned},${member},${foreign})`,
  })
  expect(Object.fromEntries(urls[2].searchParams)).toMatchObject({ select: 'id,logo_url', archived_at: 'is.null',
    id: `in.(${owned},${member},${foreign})`, or: `(user_id.eq.${actor},id.in.(${member}))`, logo_url: 'not.is.null',
  })
})

it.each([{}, { ids: null }, { ids: ['invalid'] }, { ids: Array(51).fill(owned) }, { ids: [owned], userId: actor }])('rejects malformed or unbounded requests before reading', async body => {
  expect((await call(body)).status).toBe(400)
  expect(createUserSupabase).not.toHaveBeenCalled()
})
it('rejects oversized bodies before parsing', async () => {
  expect((await call({ ids: ['x'.repeat(5000)] })).status).toBe(413)
  expect(createUserSupabase).not.toHaveBeenCalled()
})
it.each([null, { id: actor, is_anonymous: true }])('does not admit a missing or anonymous identity', async user => {
  const { urls } = fixture(false, user)
  expect((await call({ ids: [owned] })).status).toBe(401)
  expect(urls).toEqual([])
})
it.each([[true, 403], [null, 503]])('fails closed on restricted or unknown location access (%s)', async (scope, status) => {
  const { urls } = fixture(scope)
  expect((await call({ ids: [owned] })).status).toBe(status)
  expect(urls).toHaveLength(1)
})
it.each(['site_members', 'sites'])('returns no partial project data or database messages on %s failure', async resource => {
  const { urls } = fixture(false, { id: actor }, resource)
  const response = await call({ ids: [owned, member] })
  expect(response.status).toBe(503)
  expect(await response.text()).not.toMatch(/mine|shared|diagnostic/)
  expect(urls.at(-1)?.pathname).toContain(resource)
})