/** @jest-environment node */
import { NextResponse } from 'next/server'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { GET } from '@/app/api/procurement/commerce/quotes/route'

jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))
const access = jest.mocked(requireSiteAccess)
const site = '00000000-0000-4000-8000-000000000001'
const request = (query = `site_id=${site}`) => new Request(`http://localhost/api/procurement/commerce/quotes?${query}`)
let rpc: jest.Mock
beforeEach(() => {
  jest.clearAllMocks()
  rpc = jest.fn().mockResolvedValue({ data: [], error: null })
  access.mockResolvedValue({ role: 'owner', userId: site, supabase: { rpc } } as never)
})

test('returns envelope counts alongside opened quotations with private no-store caching', async () => {
  const envelopes = [{ tender_id: 'tender', publication_id: 'publication', received_count: 2 }]
  rpc.mockImplementation(async name => ({ data: name === 'list_procurement_quotation_envelopes' ? envelopes : [], error: null }))
  const response = await GET(request())
  expect(await response.json()).toEqual({ data: [], envelopes })
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(access).toHaveBeenCalledWith(expect.any(Request), site, { requireManager: true })
  expect(rpc).toHaveBeenCalledWith('list_procurement_quotation_envelopes', { p_site: site })
})
test.each([401, 403])('does not read receipt metadata without authorization (%s)', async status => {
  access.mockResolvedValue({ error: NextResponse.json({ error: 'Denied' }, { status }) })
  expect((await GET(request())).status).toBe(status)
  expect(rpc).not.toHaveBeenCalled()
})
test.each(['site_id=bad', `site_id=${site}&site_id=${site}`])('rejects malformed scope %s', async query => {
  expect((await GET(request(query))).status).toBe(400)
  expect(rpc).not.toHaveBeenCalled()
})
test('does not misrepresent a missing migration as zero received quotations', async () => {
  rpc.mockImplementation(async name => name === 'list_procurement_quotation_envelopes'
    ? { data: null, error: { code: '42883', message: 'private database detail' } } : { data: [], error: null })
  const response = await GET(request())
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain('private database detail')
})