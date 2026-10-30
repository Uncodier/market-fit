/** @jest-environment node */
import { NextResponse } from 'next/server'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { GET } from '@/app/api/procurement/suppliers/[id]/company/route'

jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))
const access = jest.mocked(requireSiteAccess)
const site = '00000000-0000-4000-8000-000000000001'
const id = '00000000-0000-4000-8000-000000000002'
const companyId = '00000000-0000-4000-8000-000000000003'
const foreignId = '00000000-0000-4000-8000-000000000004'
const context = { params: Promise.resolve({ id }) }
const request = (query = `site_id=${site}`) => new Request(
  `http://localhost/api/procurement/suppliers/${id}/company?${query}`,
  { headers: { cookie: 'session=test' } },
)
const makeQuery = () => {
  const query = {
    select: jest.fn(), eq: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  return query
}
let supplier: ReturnType<typeof makeQuery>
let company: ReturnType<typeof makeQuery>
let from: jest.Mock
let rpc: jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  supplier = makeQuery()
  supplier.maybeSingle.mockResolvedValue({ data: { id, site_id: site, company_id: companyId }, error: null })
  company = makeQuery()
  from = jest.fn(table => table === 'suppliers' ? supplier : company)
  rpc = jest.fn().mockResolvedValue({ data: true, error: null })
  access.mockResolvedValue({ role: 'collaborator', userId: id, userEmail: null, supabase: { from, rpc } } as never)
})

describe('supplier linked company read boundary', () => {
  it.each([401, 403])('preserves access denial %i without reading tables', async status => {
    access.mockResolvedValue({ error: NextResponse.json({ error: 'Denied' }, { status }) })
    const response = await GET(request(), context)
    expect(response.status).toBe(status)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(from).not.toHaveBeenCalled()
  })

  it('checks the select permission independently', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    expect((await GET(request(), context)).status).toBe(403)
    expect(access).toHaveBeenCalledWith(expect.any(Request), site)
    expect(rpc).toHaveBeenCalledWith('user_can', { p_site_id: site, p_command: 'select' })
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects malformed supplier and workspace parameters before table reads', async () => {
    const bad = await GET(request(), { params: Promise.resolve({ id: 'bad' }) })
    expect(bad.status).toBe(400)
    expect(bad.headers.get('cache-control')).toBe('private, no-store')
    for (const query of ['', 'site_id=bad', `site_id=${site}&site_id=${site}`]) {
      expect((await GET(request(query), context)).status).toBe(400)
    }
    expect(from).not.toHaveBeenCalled()
  })

  it.each([null, { id, site_id: foreignId, company_id: companyId }])(
    'does not reveal a foreign or missing supplier', async data => {
      supplier.maybeSingle.mockResolvedValue({ data, error: null })
      const response = await GET(request(), context)
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'Supplier not found' })
      expect(supplier.select).toHaveBeenCalledWith('id,site_id,company_id')
      expect(supplier.eq).toHaveBeenCalledWith('site_id', site)
      expect(supplier.eq).toHaveBeenCalledWith('id', id)
      expect(from).not.toHaveBeenCalledWith('companies')
    },
  )

  it('returns null for an unlinked supplier without reading companies', async () => {
    supplier.maybeSingle.mockResolvedValue({ data: { id, site_id: site, company_id: null }, error: null })
    const response = await GET(request(), context)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ company: null })
    expect(from).not.toHaveBeenCalledWith('companies')
  })

  it('returns null when RLS hides the linked company', async () => {
    const response = await GET(request(), context)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ company: null })
    expect(company.eq).toHaveBeenCalledWith('id', companyId)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('reads the server-owned linkage with the full explicit Company projection only', async () => {
    const fields = [
      'id', 'name', 'legal_name', 'website', 'email', 'phone', 'linkedin_url',
      'industry', 'size', 'employees_count', 'annual_revenue', 'founded', 'description',
      'tax_id', 'tax_country', 'registration_number', 'vat_number', 'legal_structure',
      'is_public', 'stock_symbol', 'parent_company_id', 'address', 'created_at', 'updated_at',
    ]
    const readable = { id: companyId, name: 'Linked company', tax_id: 'TEST-TAX',
      address: { city: 'Test City' }, created_at: '2026-01-01', updated_at: '2026-01-02' }
    company.maybeSingle.mockResolvedValue({ data: { ...readable, secret: 'NOT FOR RESPONSE' }, error: null })
    const response = await GET(request(`site_id=${site}&company_id=${foreignId}`), context)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ company: readable })
    expect(company.select).toHaveBeenCalledWith(fields.join(','))
    expect(company.eq).toHaveBeenCalledTimes(1)
    expect(company.eq).toHaveBeenCalledWith('id', companyId)
    expect(from.mock.calls.map(call => call[0])).toEqual(['suppliers', 'companies'])
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it.each(['supplier', 'company'])('returns a distinct safe %s query failure', async stage => {
    const query = stage === 'supplier' ? supplier : company
    query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'SECRET PROVIDER DETAIL' } })
    const response = await GET(request(), context)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: stage === 'supplier'
      ? 'Unable to load supplier' : 'Unable to load linked company' })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    if (stage === 'supplier') expect(from).not.toHaveBeenCalledWith('companies')
  })

  it('handles unexpected failures without disclosing database details', async () => {
    company.maybeSingle.mockRejectedValue(new Error('SECRET PROVIDER DETAIL'))
    const response = await GET(request(), context)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Unable to load supplier company' })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
})