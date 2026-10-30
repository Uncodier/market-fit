/** @jest-environment node */
import { createClient } from '@/lib/supabase/server'
import { POST } from '@/app/api/procurement/credentials/participation/register/route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const create = jest.mocked(createClient)
const publication = '00000000-0000-4000-8000-000000000001'
const supplier = '00000000-0000-4000-8000-000000000002'
let rpc: jest.Mock
function request(body: unknown = { publication_id: publication }, headers = {}, query = '') {
  return new Request(`http://localhost/api/procurement/credentials/participation/register${query}`, {
    method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}
beforeEach(() => {
  jest.clearAllMocks()
  rpc = jest.fn().mockResolvedValue({ data: supplier, error: null })
  create.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'account' } }, error: null }) }, rpc } as never)
})

test('registers by publication with user-scoped access, without buyer membership or client identity', async () => {
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ supplier_id: supplier })
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(create).toHaveBeenCalledWith(true)
  expect(rpc).toHaveBeenCalledWith('register_open_tender_participant', { p_publication: publication })
})
test('routes a strict business UUID to the separate user-scoped authorization RPC', async () => {
  const response = await POST(request({ publication_id: publication, acting_site_id: supplier }))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ supplier_id: supplier })
  expect(rpc).toHaveBeenCalledWith('register_open_tender_business', { p_publication: publication, p_acting_site: supplier })
  expect(create).toHaveBeenCalledWith(true)
})
test.each([null, '', 'forged', 42, {}, [], true])('rejects invalid acting_site_id %p before RPC', async value => {
  expect((await POST(request({ publication_id: publication, acting_site_id: value }))).status).toBe(400)
  expect(rpc).not.toHaveBeenCalled()
})
test('does not fall back to self when business authorization fails', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'private details' } })
  const response = await POST(request({ publication_id: publication, acting_site_id: supplier }))
  expect(response.status).toBe(403)
  expect(JSON.stringify(await response.json())).not.toContain('private details')
  expect(rpc).toHaveBeenCalledTimes(1)
})
test('rejects unauthenticated, cross-origin and demo registrations', async () => {
  expect((await POST(request(undefined, { origin: 'https://attacker.test' }))).status).toBe(403)
  expect((await POST(request(undefined, { cookie: 'market_fit_demo_site_id=demo-1' }))).status).toBe(403)
  expect(create).not.toHaveBeenCalled()
  create.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never)
  expect((await POST(request())).status).toBe(401)
  expect(rpc).not.toHaveBeenCalled()
})
test('rejects forged supplier/user/workspace input and query parameters before RPC', async () => {
  for (const field of ['supplier_id', 'user_id', 'site_id']) {
    expect((await POST(request({ publication_id: publication, [field]: supplier }))).status).toBe(400)
  }
  expect((await POST(request({ publication_id: 'invalid' }))).status).toBe(400)
  expect((await POST(request(undefined, {}, '?site_id=forged'))).status).toBe(400)
  expect((await POST(request(undefined, { 'content-length': '200000' }))).status).toBe(413)
  expect(rpc).not.toHaveBeenCalled()
})
test('returns safe errors for restricted/expired/unconfirmed registration and unavailable migrations', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'private details' } })
  const denied = await POST(request())
  expect(denied.status).toBe(403)
  expect(JSON.stringify(await denied.json())).not.toContain('private details')
  rpc.mockResolvedValue({ data: null, error: { code: '42883', message: 'private details' } })
  expect((await POST(request())).status).toBe(503)
  rpc.mockResolvedValue({ data: null, error: null })
  expect((await POST(request())).status).toBe(503)
})