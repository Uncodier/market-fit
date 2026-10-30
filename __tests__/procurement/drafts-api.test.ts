/** @jest-environment node */
import { createClient } from '@/lib/supabase/server'
import { GET, PUT, DELETE } from '@/app/api/procurement/credentials/drafts/route'
import { GET as participation } from '@/app/api/procurement/credentials/participation/route'
import { draftSchema } from '@/app/home/submissions/draft-schema'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const create = jest.mocked(createClient)
const id = '00000000-0000-4000-8000-000000000001'
const selector = { publication_id: id, version: 1, applicant_key: 'personal' }
const draft = { reference: '', prices: {}, evidence: {}, key: id, attempted: false,
  registeredSupplier: null, proposalRevision: '', holderName: '' }
let rpc: jest.Mock
const url = 'http://localhost/api/procurement/credentials/drafts'
function request(method = 'GET', extra = {}) {
  if (method === 'PUT') return new Request(url, { method, headers: { origin: 'http://localhost', 'content-type': 'application/json' },
    body: JSON.stringify({ ...selector, expected_revision: null, draft, ...extra }) })
  return new Request(`${url}?${new URLSearchParams(Object.entries({ ...selector,
    ...(method === 'DELETE' ? { expected_revision: 1 } : {}), ...extra }).map(([k, v]) => [k, String(v)]))}`,
  { method, headers: { origin: 'http://localhost' } })
}
beforeEach(() => {
  jest.clearAllMocks()
  rpc = jest.fn().mockResolvedValue({ data: { draft, draft_revision: 2 }, error: null })
  create.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id } }, error: null }) }, rpc } as never)
})
test('all operations authenticate and mutations enforce origin and demo restrictions', async () => {
  create.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never)
  for (const [method, handler] of [['GET', GET], ['PUT', PUT], ['DELETE', DELETE]] as const) {
    expect((await handler(request(method))).status).toBe(401)
  }
  const foreign = request('PUT'); foreign.headers.set('origin', 'https://attacker.test')
  expect((await PUT(foreign)).status).toBe(403)
  const demo = request(); demo.headers.set('cookie', 'market_fit_demo_site_id=demo')
  expect((await GET(demo)).status).toBe(403)
  expect(rpc).not.toHaveBeenCalled()
})
test('strict selectors, unknown authority fields, duplicates and missing CAS are denied', async () => {
  for (const extra of [{ site_id: id }, { owner_id: id }, { version: '1e0' }, { applicant_key: 'supplier:invalid' }]) {
    expect((await GET(request('GET', extra))).status).toBe(400)
  }
  expect((await GET(new Request(request().url + '&version=1'))).status).toBe(400)
  expect((await PUT(request('PUT', { expected_revision: undefined }))).status).toBe(400)
  expect((await PUT(request('PUT', { draft: { ...draft, site_id: id } }))).status).toBe(400)
  expect((await DELETE(request('DELETE', { expected_revision: '0' }))).status).toBe(400)
  expect(rpc).not.toHaveBeenCalled()
})
test('uses authenticated RPC without client tenant/owner and returns private canonical revision', async () => {
  expect((await GET(request())).status).toBe(200)
  const response = await PUT(request('PUT', { expected_revision: 1, draft: { ...draft, attempted: true } }))
  expect(await response.json()).toEqual({ draft, draft_revision: 2 })
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(create).toHaveBeenCalledWith(true)
  expect(rpc).toHaveBeenLastCalledWith('procurement_submission_draft', { p_action: 'put', p_publication: id,
    p_version: 1, p_applicant: 'personal', p_expected_revision: 1, p_draft: { ...draft, attempted: true } })
  expect((await DELETE(request('DELETE'))).status).toBe(200)
})
test('bounded input fails before database, and database errors never expose internals', async () => {
  const large = request('PUT'); large.headers.set('content-length', '131073')
  expect((await PUT(large)).status).toBe(413)
  expect((await PUT(request('PUT', { draft: { ...draft, prices: Object.fromEntries(Array.from({ length: 201 }, (_, n) => [String(n), '1'])) } }))).status).toBe(400)
  expect(rpc).not.toHaveBeenCalled()
  for (const [code, status] of [['42501', 403], ['40001', 409], ['23505', 409], ['22023', 400], ['XX000', 503]] as const) {
    rpc.mockResolvedValue({ error: { code, message: 'secret database detail' } })
    const response = await PUT(request('PUT'))
    expect(response.status).toBe(status)
    expect(await response.text()).not.toContain('secret')
  }
})
test('existing hook shape and filtered participation classification remain canonical', async () => {
  expect(draftSchema.parse(draft)).toEqual(draft)
  expect((await participation(new Request('http://localhost/api/procurement/credentials/participation'))).status).toBe(200)
  expect(rpc).toHaveBeenLastCalledWith('my_procurement_participation_details')
})