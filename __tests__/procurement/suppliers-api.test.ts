/** @jest-environment node */
import { NextResponse } from 'next/server'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { GET, POST } from '@/app/api/procurement/suppliers/route'
import { GET as detail, PUT } from '@/app/api/procurement/suppliers/[id]/route'
import { GET as references } from '@/app/api/procurement/suppliers/references/route'
import { GET as activity } from '@/app/api/procurement/suppliers/[id]/activity/route'
import { supplierInputSchema } from '@/app/suppliers/schema'

jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))
const access = jest.mocked(requireSiteAccess)
const site = '00000000-0000-4000-8000-000000000001'
const id = '00000000-0000-4000-8000-000000000002'
const context = { params: Promise.resolve({ id }) }
const input = { expected_version: 0, name: 'Professional', status: 'prospect', company_id: null,
  contacts: [], commercial_terms: 'Net 30', private_notes: 'Private', category_ids: [] }
const request = (method = 'GET', body?: unknown, query = '') => new Request(`http://localhost/api/procurement/suppliers?site_id=${site}${query}`, {
  method, headers: { cookie: 'session=test' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
})
let rpc: jest.Mock
let from: jest.Mock
let query: Record<string, jest.Mock>
beforeEach(() => {
  jest.clearAllMocks()
  rpc = jest.fn().mockResolvedValue({ data: true, error: null })
  query = {}
  for (const method of ['select', 'eq', 'order', 'range', 'ilike', 'limit']) query[method] = jest.fn(() => query)
  query.then = jest.fn(resolve => Promise.resolve({ data: [], count: 0, error: null }).then(resolve))
  query.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })
  from = jest.fn(() => query)
  access.mockResolvedValue({ role: 'collaborator', userId: id, userEmail: null, supabase: { rpc, from } } as never)
})
describe('supplier API boundaries', () => {
  it.each([401, 403])('preserves authentication and tenant denial %i', async status => {
    access.mockResolvedValue({ error: NextResponse.json({ error: 'Denied' }, { status }) })
    expect((await GET(request())).status).toBe(status)
    expect((await POST(request('POST', input))).status).toBe(status)
    expect((await detail(request(), context)).status).toBe(status)
    expect((await PUT(request('PUT', { ...input, expected_version: 1 }), context)).status).toBe(status)
    expect((await references(request('GET', undefined, '&kind=categories'))).status).toBe(status)
    expect((await activity(request(), context)).status).toBe(status)
    expect(from).not.toHaveBeenCalled()
  })
  it('uses unscoped requireSiteAccess and user_can independently for reads and edits', async () => {
    expect((await GET(request())).status).toBe(200)
    expect(access).toHaveBeenCalledWith(expect.any(Request), site)
    expect(rpc).toHaveBeenCalledWith('user_can', { p_site_id: site, p_command: 'select' })
    expect(query.eq).toHaveBeenCalledWith('site_id', site)
    rpc.mockResolvedValue({ data: false, error: null })
    expect((await GET(request())).status).toBe(403)
    expect((await POST(request('POST', input))).status).toBe(403)
  })
  it('denies non-editor writes and demo requests', async () => {
    access.mockResolvedValue({ role: 'marketing', supabase: { rpc, from } } as never)
    expect((await POST(request('POST', input))).status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
    const demo = request(); demo.headers.set('cookie', 'market_fit_demo_site_id=demo-1')
    expect((await GET(demo)).status).toBe(403)
  })
  it('validates IDs, repeated tenant parameters, malformed inputs and bounded body', async () => {
    expect((await GET(new Request('http://localhost/api/procurement/suppliers?site_id=bad'))).status).toBe(400)
    expect((await GET(request('GET', undefined, `&site_id=${site}`))).status).toBe(400)
    expect((await GET(request('GET', undefined, '&offset=-1'))).status).toBe(400)
    expect((await PUT(request('PUT', input), { params: Promise.resolve({ id: 'bad' }) })).status).toBe(400)
    for (const body of [{ ...input, site_id: id }, { ...input, supplier_user_id: id }, { ...input, expected_version: 1 }, { ...input, status: 'archived' }]) {
      expect((await POST(request('POST', body))).status).toBe(400)
    }
    expect((await POST(request('POST', { ...input, private_notes: 'x'.repeat(140000) }))).status).toBe(413)
  })
  it('creates atomically and passes only the authorized tenant to the RPC', async () => {
    rpc.mockImplementation(async name => name === 'user_can' ? { data: true } : { data: { id, site_id: site, version: 1, ...input } })
    const response = await POST(request('POST', input))
    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const document = { name: input.name, status: input.status, company_id: input.company_id,
      commercial_terms: input.commercial_terms, private_notes: input.private_notes,
      contacts: input.contacts, category_ids: input.category_ids }
    expect(rpc).toHaveBeenCalledWith('save_procurement_supplier', { p_site_id: site, p_id: null, p_expected_version: 0, p_document: document })
  })
  it.each([['40001', 409], ['42501', 403], ['23514', 400], ['XX000', 503]])('maps %s safely to %i', async (code, status) => {
    rpc.mockImplementation(async name => name === 'user_can' ? { data: true } : { error: { code, message: 'SECRET DATABASE DETAILS' } })
    const response = await PUT(request('PUT', { ...input, expected_version: 1 }), context)
    expect(response.status).toBe(status)
    expect(await response.text()).not.toContain('SECRET')
  })
  it('does not reveal a foreign or missing detail', async () => {
    expect((await detail(request(), context)).status).toBe(404)
    expect(query.eq).toHaveBeenCalledWith('site_id', site)
    expect(query.eq).toHaveBeenCalledWith('id', id)
  })
  it('scopes category lookup and activity reads to the authorized workspace', async () => {
    expect((await references(request('GET', undefined, '&kind=categories'))).status).toBe(200)
    expect(from).toHaveBeenCalledWith('catalog_categories')
    expect(query.eq).toHaveBeenCalledWith('site_id', site)
    expect(query.eq).toHaveBeenCalledWith('status', 'active')
    expect((await activity(request(), context)).status).toBe(200)
    expect(from).toHaveBeenCalledWith('supplier_activity')
    expect(query.eq).toHaveBeenCalledWith('supplier_id', id)
    expect(query.limit).toHaveBeenCalledWith(100)
  })
  it('never includes private notes or contacts in list projections', async () => {
    await GET(request())
    expect(query.select.mock.calls[0][0]).not.toContain('private_notes')
    expect(query.select.mock.calls[0][0]).not.toContain('supplier_contacts')
  })
  it('refuses to confirm an empty or mismatched save result', async () => {
    rpc.mockImplementation(async name => name === 'user_can' ? { data: true } : { data: null })
    expect((await POST(request('POST', input))).status).toBe(503)
  })
  it('validates normalized contacts without making them account identities', () => {
    expect(supplierInputSchema.safeParse(input).success).toBe(true)
    expect(supplierInputSchema.safeParse({ ...input, contacts: [{ name: 'A', user_id: id }] }).success).toBe(false)
    expect(supplierInputSchema.safeParse({ ...input, category_ids: [id, id] }).success).toBe(false)
    expect(supplierInputSchema.safeParse({ ...input, contacts: [{ name: 'A', is_primary: true }, { name: 'B', is_primary: true }] }).success).toBe(false)
  })
})