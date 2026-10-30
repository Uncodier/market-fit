/** @jest-environment node */
import { NextResponse } from 'next/server'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { GET, POST } from '@/app/api/procurement/commerce/quotes/route'
import { POST as receipt } from '@/app/api/procurement/commerce/receipts/route'
import { GET as orders } from '@/app/api/procurement/commerce/orders/route'
import { GET as options } from '@/app/api/procurement/commerce/options/route'

jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))
const access = jest.mocked(requireSiteAccess)
const site = '00000000-0000-4000-8000-000000000001'
const id = '00000000-0000-4000-8000-000000000002'
const input = { supplier_id: id, tender_id: id, publication_id: id, reference: 'External 123', idempotency_key: id,
  lines: [{ requirement_id: id, unit_net_minor: 1200 }] }
const request = (body?: unknown, query = `site_id=${site}`) => new Request(`http://localhost/api/procurement/commerce/quotes?${query}`, {
  method: body ? 'POST' : 'GET', headers: { cookie: 'session=test', 'Content-Type': 'application/json' },
  ...(body ? { body: JSON.stringify(body) } : {}),
})
let rpc: jest.Mock
beforeEach(() => {
  jest.clearAllMocks()
  rpc = jest.fn().mockResolvedValue({ data: [], error: null })
  access.mockResolvedValue({ role: 'owner', userId: id, userEmail: null, supabase: { rpc } } as never)
})

it.each([401, 403])('preserves authorization failure %s for every commerce route', async status => {
  access.mockResolvedValue({ error: NextResponse.json({ error: 'Denied' }, { status }) })
  for (const handler of [GET, orders, options]) expect((await handler(request())).status).toBe(status)
  expect((await POST(request(input))).status).toBe(status)
  expect((await receipt(request(input))).status).toBe(status)
  expect(rpc).not.toHaveBeenCalled()
})
it('validates tenant and rejects user/price/tax authority forgery', async () => {
  expect((await GET(request(undefined, `site_id=${site}&site_id=${id}`))).status).toBe(400)
  expect((await GET(request(undefined, 'site_id=invalid'))).status).toBe(400)
  for (const document of [{ ...input, user_id: id }, { ...input, site_id: id }, { ...input, tax_total: 1 },
    { ...input, lines: [{ requirement_id: id, unit_net_minor: -1 }] }]) {
    expect((await POST(request(document))).status).toBe(400)
  }
  expect(rpc).not.toHaveBeenCalled()
})
it('uses authenticated manager access and no-store scoped RPC', async () => {
  const response = await POST(request(input))
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(access).toHaveBeenCalledWith(expect.any(Request), site, { requireManager: true })
  expect(rpc).toHaveBeenCalledWith('record_procurement_quotation', { p_site: site, p_document: input })
})
it('rejects oversized and malformed payloads without executing a write', async () => {
  expect((await POST(request({ ...input, reference: 'x'.repeat(40000) }))).status).toBe(400)
  expect((await POST(new Request(`http://localhost/?site_id=${site}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }))).status).toBe(400)
  expect(rpc).not.toHaveBeenCalled()
})
it('does not reveal provider details on a stale receipt', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'SECRET' } })
  const response = await receipt(request({ order_id: id, idempotency_key: id, note: 'Accepted', lines: [{ item_id: id, quantity: 1 }] }))
  expect(response.status).toBe(409)
  expect(await response.text()).not.toContain('SECRET')
})