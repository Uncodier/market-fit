/** @jest-environment node */
import { cookies } from 'next/headers'
import { GET } from '@/app/api/site-members/[siteId]/route'

jest.mock('server-only', () => ({}))
jest.mock('next/headers', () => ({ cookies: jest.fn() }))

const siteId = '11111111-1111-4111-8111-111111111111'
const actor = '22222222-2222-4222-8222-222222222222'
const owner = '33333333-3333-4333-8333-333333333333'
const origin = 'https://members.supabase.test'
const signedIn = '2026-01-12T00:00:00Z'
const otherSignIn = '2026-02-15T00:00:00Z'
const userPath = '/auth/v1/user'
const adminPath = '/auth/v1/admin/users/'
const locationPath = '/rest/v1/rpc/current_user_has_location_restrictions'
const rolePath = '/rest/v1/rpc/current_user_site_role'

// Exercise the route, the access helper, the guarded service transport and the
// installed Supabase SDKs. Only the external HTTP boundary and cookies are fake.
function setup() {
  jest.replaceProperty(process, 'env', { ...process.env, NEXT_PUBLIC_SUPABASE_URL: origin,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-anon', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service' })
  const state = { lastSignIn: signedIn as string | undefined, signedOut: false, role: 'collaborator' as string | null }
  const paths: string[] = []
  jest.mocked(global.fetch).mockImplementation(async input => {
    const url = new URL(String(input))
    paths.push(url.pathname)
    if (url.origin !== origin) throw new Error('Unexpected test origin')
    switch (url.pathname) {
      case userPath:
        return state.signedOut ? Response.json({ message: 'Invalid session' }, { status: 401 }) : Response.json({
          id: actor, email_confirmed_at: signedIn, last_sign_in_at: state.lastSignIn,
          user_metadata: { private: 'not-for-the-member-list' },
        })
      case locationPath: return Response.json(false)
      case rolePath: return Response.json(state.role)
      case '/rest/v1/sites': return Response.json({ user_id: owner })
      case '/rest/v1/site_members': return Response.json([
        { id: 'self', site_id: siteId, user_id: actor, status: 'active' },
        { id: 'other', site_id: siteId, user_id: owner, status: 'active' },
      ])
      case adminPath + actor: return Response.json({ id: actor, last_sign_in_at: otherSignIn })
      case adminPath + owner: return Response.json({ id: owner, last_sign_in_at: otherSignIn })
      default: throw new Error('Unexpected Supabase request')
    }
  })
  async function get() {
    // Neither a different ID in local session data nor an input ID selects the caller.
    const session = { access_token: 'synthetic-access', refresh_token: 'synthetic-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: owner, last_sign_in_at: 'untrusted' } }
    const cookie = { name: 'sb-members-auth-token', value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}` }
    const store = { getAll: () => [cookie], set: jest.fn(), delete: jest.fn(), get: jest.fn(),
      has: jest.fn(), size: 1, [Symbol.iterator]: jest.fn() } satisfies Awaited<ReturnType<typeof cookies>>
    jest.mocked(cookies).mockResolvedValue(store)
    const req = new Request(`https://app.test/api/site-members/${siteId}?userId=${owner}`)
    return GET(req, { params: Promise.resolve({ siteId }) })
  }
  const count = (path: string) => paths.filter(value => value === path).length
  return { get, state, paths, count }
}

afterEach(() => jest.restoreAllMocks())

it('reuses only the verified caller status; all remaining service reads keep their fresh gates', async () => {
  const { get, state, paths, count } = setup()
  for (const lastSignIn of [signedIn, '2026-03-20T00:00:00Z']) {
    state.lastSignIn = lastSignIn
    paths.length = 0
    const response = await get()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(paths.filter(path => path.startsWith(adminPath))).toEqual([adminPath + owner])
    // Route entry plus a guard for the site, member list and other member's Admin Auth read.
    expect(count(userPath)).toBe(4)
    expect(count(locationPath)).toBe(3)
    expect(count(rolePath)).toBe(1)
    const body = await response.json()
    expect(body.members).toEqual([
      expect.objectContaining({ id: 'self', emailConfirmed: true, lastSignIn, status: 'active' }),
      expect.objectContaining({ id: 'other', emailConfirmed: false, lastSignIn: otherSignIn, is_primary_owner: true }),
    ])
    expect(JSON.stringify(body)).not.toContain('not-for-the-member-list')
  }
})

it('retains the guarded Admin Auth fallback if the verified caller projection is incomplete', async () => {
  const { get, state, count } = setup()
  state.lastSignIn = undefined
  const response = await get()
  expect(response.status).toBe(200)
  expect(count(adminPath + actor)).toBe(1)
  expect(count(adminPath + owner)).toBe(1)
  expect(count(userPath)).toBe(5)
  expect(count(locationPath)).toBe(4)
  expect((await response.json()).members[0]).toMatchObject({ emailConfirmed: false, lastSignIn: otherSignIn })
})

it('rechecks membership and identity on independent requests, before listing any members', async () => {
  const { get, state, paths } = setup()
  expect((await get()).status).toBe(200)
  paths.length = 0
  state.role = null
  expect((await get()).status).toBe(403)
  expect(paths).toEqual([userPath, userPath, locationPath, '/rest/v1/sites', rolePath])
  paths.length = 0
  state.signedOut = true
  expect((await get()).status).toBe(401)
  expect(paths).toEqual([userPath])
})