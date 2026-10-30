/** @jest-environment node */
import { createClient } from '@/lib/supabase/server'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { POST } from '@/app/api/procurement/commerce/submissions/route'
import { GET } from '@/app/api/procurement/credentials/proposals/route'
import { supplierSubmissionSchema, importQuotationSchema } from '@/app/purchases/procurement/commerce/contracts'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))
const id = '00000000-0000-4000-8000-000000000001'
const document = { supplier_id: id, tender_id: id, publication_id: id, reference: 'Proposal',
  lines: [{ requirement_id: id, unit_net_minor: 100 }], idempotency_key: id }
let rpc: jest.Mock; let query: Record<string, jest.Mock>; let from: jest.Mock
const request = (body: unknown = document) => new Request(`http://localhost/api/procurement/commerce/submissions?site_id=${id}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})
const buyerRequest = (suffix = '') => new Request(`http://localhost/api/procurement/credentials/proposals?site_id=${id}&quotation_id=${id}${suffix}`)
beforeEach(() => {
  jest.clearAllMocks()
  rpc = jest.fn().mockResolvedValue({ data: id, error: null })
  query = {}
  for (const method of ['select', 'eq']) query[method] = jest.fn(() => query)
  query.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })
  from = jest.fn(() => query)
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id } }, error: null }) }, rpc } as never)
  jest.mocked(requireSiteAccess).mockResolvedValue({ supabase: { from }, user: { id } } as never)
})
test('contract accepts optional UUID but not null, paths, forged fields or buyer imports', () => {
  expect(supplierSubmissionSchema.safeParse(document).success).toBe(true)
  expect(supplierSubmissionSchema.safeParse({ ...document, proposal_revision_id: id }).success).toBe(true)
  for (const value of [null, '', 'https://attacker.test/file.pdf', {}, 1]) {
    expect(supplierSubmissionSchema.safeParse({ ...document, proposal_revision_id: value }).success).toBe(false)
  }
  expect(importQuotationSchema.safeParse({ ...document, proposal_revision_id: id }).success).toBe(false)
})
test('passes uploaded revision ID in the same user-scoped atomic submission RPC', async () => {
  const body = { ...document, proposal_revision_id: id }
  const response = await POST(request(body))
  expect(response.status).toBe(200)
  expect(rpc).toHaveBeenCalledWith('submit_procurement_quotation', { p_site: id, p_document: { ...body, evidence: [] } })
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
})
test('invalid revision, unauthenticated submission and private revision denial fail safely', async () => {
  expect((await POST(request({ ...document, proposal_revision_id: 'bad' }))).status).toBe(400)
  expect(rpc).not.toHaveBeenCalled()
  rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'private path' } })
  const denied = await POST(request({ ...document, proposal_revision_id: id }))
  expect(denied.status).toBe(403)
  expect(JSON.stringify(await denied.json())).not.toContain('private path')
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never)
  expect((await POST(request())).status).toBe(401)
})
test('buyer lookup is independently authorized, site scoped and returns null while sealed', async () => {
  const result = await GET(buyerRequest())
  expect(await result.json()).toEqual({ proposal: null })
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), id, { requireManager: true })
  expect(from).toHaveBeenCalledWith('procurement_quotation_attachments')
  expect(query.eq).toHaveBeenCalledWith('site_id', id)
  expect(query.eq).toHaveBeenCalledWith('quotation_id', id)
  expect(result.headers.get('cache-control')).toBe('private, no-store')
  expect((await GET(buyerRequest('&quotation_id=bad'))).status).toBe(400)
  expect((await GET(buyerRequest('&user_id=forged'))).status).toBe(400)
})
test('buyer authorization and missing migration errors are not masked as empty proposals', async () => {
  jest.mocked(requireSiteAccess).mockResolvedValue({ error: new Response(null, { status: 403 }) } as never)
  expect((await GET(buyerRequest())).status).toBe(403)
  expect(from).not.toHaveBeenCalled()
  jest.mocked(requireSiteAccess).mockResolvedValue({ supabase: { from }, user: { id } } as never)
  query.maybeSingle.mockResolvedValue({ data: null, error: { code: '42P01' } })
  expect((await GET(buyerRequest())).status).toBe(503)
})
