/** @jest-environment node */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { locationGuardedServiceFetch } from '@/lib/supabase/service-location-guard'

jest.mock('server-only', () => ({}))
jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: jest.fn() }))

describe('privileged service location boundary', () => {
  const getUser = jest.fn()
  const rpc = jest.fn()
  const from = jest.fn()
  const outbound = jest.fn()
  const originalFetch = global.fetch
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = outbound
    outbound.mockResolvedValue(new Response('{}', { status: 200 }))
    jest.mocked(cookies).mockResolvedValue({ getAll: () => [] } as never)
    jest.mocked(createServerClient).mockReturnValue({ auth: { getUser }, rpc, from } as never)
    getUser.mockResolvedValue({ data: { user: { id: 'actor' } }, error: null })
    rpc.mockResolvedValue({ data: false, error: null })
  })
  afterAll(() => { global.fetch = originalFetch })

  it('authorizes before every request and refuses a newly restricted actor with a warm client', async () => {
    const transport = locationGuardedServiceFetch()
    expect((await transport('https://example.test')).status).toBe(200)
    rpc.mockResolvedValue({ data: true, error: null })
    expect((await transport('https://example.test')).status).toBe(403)
    expect(outbound).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc).toHaveBeenCalledWith('current_user_has_location_restrictions')
  })

  it.each([null, 'false', 0])('never trusts malformed permission responses %j', async data => {
    rpc.mockResolvedValue({ data, error: null })
    expect((await locationGuardedServiceFetch()('https://example.test')).status).toBe(503)
    expect(outbound).not.toHaveBeenCalled()
  })

  it('fails closed if the scope lookup is unavailable', async () => {
    rpc.mockResolvedValue({ data: false, error: { code: 'XX000' } })
    expect((await locationGuardedServiceFetch()('https://example.test')).status).toBe(503)
    expect(outbound).not.toHaveBeenCalled()
  })

  it('requires explicit system context when request cookies are unavailable', async () => {
    jest.mocked(cookies).mockRejectedValue(new Error('No request context'))
    expect((await locationGuardedServiceFetch()('https://example.test')).status).toBe(403)
    expect((await locationGuardedServiceFetch('system')('https://example.test')).status).toBe(200)
    expect(outbound).toHaveBeenCalledTimes(1)
  })

  it('leaves explicit public contracts independent of workspace ACL', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    expect((await locationGuardedServiceFetch('public')('https://example.test')).status).toBe(200)
    expect(cookies).not.toHaveBeenCalled()
    expect(getUser).not.toHaveBeenCalled()
  })

  it('requires public paths to select their own contract rather than use a workspace service client anonymously', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { name: 'AuthSessionMissingError' } })
    expect((await locationGuardedServiceFetch()('https://example.test')).status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('fails closed if the new predicate is unavailable; an empty RLS read would not prove a disabled actor unrestricted', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } })
    from.mockReturnValue({ select: () => ({ limit: async () => ({ data: [], error: null }) }) })
    expect((await locationGuardedServiceFetch()('https://example.test')).status).toBe(503)
    expect(from).not.toHaveBeenCalled()
    expect(outbound).not.toHaveBeenCalled()
  })
})