/** @jest-environment node */
import { GET, POST } from '@/app/api/procurement/tenders/portal/route'
import { createClient } from '@/lib/supabase/server'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const site = '11111111-1111-4111-8111-111111111111'
const request = (body?: unknown, headers = {}) => new Request(`https://example.test/api/procurement/tenders/portal?site_id=${site}`, {
  method: body === undefined ? 'GET' : 'POST', headers: { cookie: 'session=x', 'content-type': 'application/json', ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

describe('workspace portal settings API', () => {
  let role: string | null
  let restricted: boolean
  let record: unknown
  let error: { code: string } | null
  let rpc: jest.Mock
  let eq: jest.Mock
  beforeEach(() => {
    role = 'admin'; restricted = false; record = { enabled: false, slug: 'workspace-portal' }; error = null
    eq = jest.fn()
    const query = { select: jest.fn(), eq, maybeSingle: async () => ({ data: record, error }) }
    query.select.mockReturnValue(query); eq.mockReturnValue(query)
    rpc = jest.fn(async (name: string) => ({ error: null, data: name === 'current_user_site_role' ? role :
      name === 'current_user_has_site_location_restrictions' ? restricted : name === 'configure_procurement_tender_portal' ? 'workspace-portal' : true }))
    jest.mocked(createClient).mockResolvedValue({ from: () => query, rpc,
      auth: { getUser: async () => ({ data: { user: { id: site } }, error: null }) },
    } as never)
  })
  test('reads actual state with tenant scope and no-store', async () => {
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(record)
    expect(eq).toHaveBeenCalledWith('site_id', site)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(rpc).not.toHaveBeenCalledWith('configure_procurement_tender_portal', expect.anything())
  })
  test('an absent portal is disabled without provisioning during GET', async () => {
    record = null
    expect(await (await GET(request())).json()).toEqual({ enabled: false, slug: null })
  })
  test('read errors and malformed persisted state do not masquerade as disabled', async () => {
    error = { code: '42P01' }
    expect((await GET(request())).status).toBe(503)
    error = null; record = { enabled: 'yes', slug: '../secret' }
    expect((await GET(request())).status).toBe(503)
  })
  test.each([null, 'collaborator'])('denies non-manager %s reads', async value => {
    role = value
    expect((await GET(request())).status).toBe(403)
    expect(eq).not.toHaveBeenCalled()
  })
  test('denies anonymous and location-restricted callers', async () => {
    expect((await GET(request(undefined, { cookie: '' }))).status).toBe(401)
    restricted = true
    expect((await GET(request())).status).toBe(403)
  })
  test('writes only explicit enabled state using the authenticated RPC', async () => {
    const response = await POST(request({ enabled: true }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ enabled: true, slug: 'workspace-portal' })
    expect(rpc).toHaveBeenCalledWith('configure_procurement_tender_portal', { p_site: site, p_enabled: true })
  })
  test('rejects forged settings and cross-origin writes', async () => {
    expect((await POST(request({ enabled: true, slug: 'forged' }))).status).toBe(400)
    expect((await POST(request({ enabled: true }, { origin: 'https://evil.test' }))).status).toBe(403)
    expect(rpc.mock.calls.some(([name]) => name === 'configure_procurement_tender_portal')).toBe(false)
  })
})