/** @jest-environment node */
import { getSiteMemberAccess } from '@/lib/auth/site-member-request'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

jest.mock('server-only', () => ({}))
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }))
jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: jest.fn().mockResolvedValue({ getAll: () => [] }) }))

const siteId = '10000000-0000-4000-8000-000000000001'

function setup(status = 'active', suspended = false, archived = false, owner = false) {
  jest.mocked(createServerClient).mockReturnValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'actor' } }, error: null }) } } as never)
  const filters: Record<string, unknown> = {}
  const membership = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockImplementation(function (this: unknown, key: string, value: unknown) { filters[key] = value; return this }),
    maybeSingle: jest.fn(async () => ({ data: filters.status === status && filters.license_suspended === suspended ? { role: 'admin' } : null, error: null })),
  }
  const site = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: archived ? null : { user_id: owner ? 'actor' : 'owner' }, error: null }) }
  const admin = { from: jest.fn((table: string) => table === 'sites' ? site : membership) }
  jest.mocked(createClient).mockReturnValue(admin as never)
  return { site, membership, admin }
}

beforeEach(() => jest.clearAllMocks())

it.each([['pending', false], ['active', true], ['rejected', false]])('does not give manager/member access to %s suspension=%s', async (status, suspended) => {
  setup(status as string, suspended as boolean)
  const access = await getSiteMemberAccess(siteId)
  expect(access).toMatchObject({ isOwner: false, isAdmin: false, isMember: false })
})

it('permits licensed active admin access', async () => {
  setup()
  expect(await getSiteMemberAccess(siteId)).toMatchObject({ isAdmin: true, isMember: true })
})

it('preserves primary owner access even without an active row', async () => {
  setup('pending', true, false, true)
  expect(await getSiteMemberAccess(siteId)).toMatchObject({ isOwner: true })
})

it('denies archived site before looking up membership', async () => {
  const { site, membership } = setup('active', false, true)
  expect((await getSiteMemberAccess(siteId)).error?.status).toBe(404)
  expect(site.is).toHaveBeenCalledWith('archived_at', null)
  expect(membership.select).not.toHaveBeenCalled()
})

it('does not create service role client when authentication throws', async () => {
  setup()
  jest.mocked(createServerClient).mockReturnValue({ auth: { getUser: jest.fn().mockRejectedValue(new Error('offline')) } } as never)
  expect((await getSiteMemberAccess(siteId)).error?.status).toBe(401)
  expect(createClient).not.toHaveBeenCalled()
})