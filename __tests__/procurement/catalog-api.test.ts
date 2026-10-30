/** @jest-environment node */
import { NextResponse } from 'next/server'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { GET, PATCH, POST } from '@/app/api/procurement/catalog/[id]/route'

jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))
const access = jest.mocked(requireSiteAccess)
const site = '00000000-0000-4000-8000-000000000001', id = '00000000-0000-4000-8000-000000000070'
const context = { params: Promise.resolve({ id }) }
const offer = { supplier_id: '00000000-0000-4000-8000-000000000071', purchase_unit: 'box',
  units_per_purchase_unit: 12, minimum_quantity: 2, lead_time_days: 7, currency: 'USD',
  unit_price_minor: 1200, valid_from: '2026-10-01', valid_until: '2026-12-31', terms: 'Net 30' }
const request = (method = 'GET', body?: unknown, query = '') => new Request(`http://localhost/api/procurement/catalog/${id}?site_id=${site}${query}`, {
  method, headers: { cookie: 'session=test', 'Idempotency-Key': id }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
})
let rpc: jest.Mock, from: jest.Mock, query: Record<string, jest.Mock>
beforeEach(() => {
  jest.clearAllMocks()
  rpc = jest.fn().mockResolvedValue({ data: true, error: null })
  query = {}
  for (const method of ['select', 'eq', 'order', 'range', 'in', 'insert', 'update']) query[method] = jest.fn(() => query)
  query.then = jest.fn(resolve => Promise.resolve({ data: [], count: 0, error: null }).then(resolve))
  query.maybeSingle = jest.fn().mockResolvedValue({ data: { id, name: 'Stock', procurement_enabled: true, status: 'active' }, error: null })
  query.single = jest.fn().mockResolvedValue({ data: { id, ...offer }, error: null })
  from = jest.fn(() => query)
  access.mockResolvedValue({ role: 'collaborator', userId: id, userEmail: null, supabase: { rpc, from } } as never)
})

describe('catalog procurement API security', () => {
  it.each([401, 403])('honors independent authentication and tenant denial %i', async status => {
    access.mockResolvedValue({ error: NextResponse.json({ error: 'Denied' }, { status }) })
    for (const [method, handler] of [['GET', GET], ['POST', POST], ['PATCH', PATCH]] as const) {
      expect((await handler(request(method), context)).status).toBe(status)
    }
    expect(from).not.toHaveBeenCalled()
  })
  it('fails closed on permission denial, lookup failure, and demo cookies', async () => {
    rpc.mockResolvedValue({ data: false })
    expect((await GET(request(), context)).status).toBe(403)
    expect((await POST(request('POST', offer), context)).status).toBe(403)
    rpc.mockResolvedValue({ error: { message: 'secret' } })
    expect((await GET(request(), context)).status).toBe(503)
    const demo = request(); demo.headers.set('cookie', 'market_fit_demo_site_id=demo-1')
    expect((await GET(demo, context)).status).toBe(403)
    expect(from).not.toHaveBeenCalled()
  })
  it('validates tenant, IDs, body limits and forbidden sale/identity fields', async () => {
    expect((await GET(request('GET', undefined, `&site_id=${site}`), context)).status).toBe(400)
    expect((await GET(request(), { params: Promise.resolve({ id: 'bad' }) })).status).toBe(400)
    expect((await GET(request('GET', undefined, '&offset=-1'), context)).status).toBe(400)
    for (const extra of [{ site_id: id }, { created_by: id }, { unit_price_minor: -1 }]) {
      expect((await POST(request('POST', { ...offer, ...extra }), context)).status).toBe(400)
    }
    expect((await POST(request('POST', { ...offer, terms: 'a'.repeat(25000) }), context)).status).toBe(413)
    const foreignOrigin = request('POST', offer); foreignOrigin.headers.set('origin', 'https://foreign.example')
    expect((await POST(foreignOrigin, context)).status).toBe(403)
    expect((await PATCH(request('PATCH', { procurement_enabled: true, expected_enabled: false, is_purchasable: false }), context)).status).toBe(400)
    expect(query.insert).not.toHaveBeenCalled()
    expect(query.update).not.toHaveBeenCalled()
  })
  it('uses scoped reads with bounded paging and no private supplier fields', async () => {
    const result = await GET(request(), context)
    expect(result.status).toBe(200)
    expect(result.headers.get('Cache-Control')).toBe('private, no-store')
    expect(access).toHaveBeenCalledWith(expect.any(Request), site)
    expect(rpc).toHaveBeenCalledWith('procurement_supplier_can', { p_site_id: site, p_command: 'select' })
    expect(query.eq).toHaveBeenCalledWith('site_id', site)
    expect(query.range).toHaveBeenCalledWith(0, 49)
    expect(query.select.mock.calls.flat().join(',')).not.toMatch(/private_notes|commercial_terms|\*/)
    query.maybeSingle.mockResolvedValue({ data: null })
    expect((await GET(request(), context)).status).toBe(404)
  })
  it('creates with server-authorized site and actor only', async () => {
    expect((await POST(request('POST', offer), context)).status).toBe(201)
    expect(query.insert).toHaveBeenCalledWith({ ...offer, site_id: site, catalog_item_id: id, created_by: id, submission_key: id })
    expect(rpc).toHaveBeenCalledWith('procurement_supplier_can', { p_site_id: site, p_command: 'insert' })
  })
  it('conditionally changes only procurement capability and reports stale updates', async () => {
    const input = { procurement_enabled: false, expected_enabled: true }
    expect((await PATCH(request('PATCH', input), context)).status).toBe(200)
    expect(query.update).toHaveBeenCalledWith({ procurement_enabled: false })
    expect(query.eq).toHaveBeenCalledWith('procurement_enabled', true)
    query.maybeSingle.mockResolvedValue({ data: null })
    expect((await PATCH(request('PATCH', input), context)).status).toBe(409)
  })
  it('never returns raw database or thrown provider errors', async () => {
    query.single.mockResolvedValue({ error: { message: 'SECRET' } })
    const result = await POST(request('POST', offer), context)
    expect(result.status).toBe(409)
    expect(await result.text()).not.toContain('SECRET')
    from.mockImplementation(() => { throw new Error('SECRET') })
    expect((await GET(request(), context)).status).toBe(503)
  })
})