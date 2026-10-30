/** @jest-environment node */
import { POST as submit } from '@/app/api/procurement/requests/[id]/submit/route'
import { POST as create, GET as list } from '@/app/api/procurement/requests/route'
import { POST as decide } from '@/app/api/procurement/requests/[id]/decisions/route'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { defaultPolicyDocument } from '@/app/purchases/procurement/domain'
import { ids, uuid } from './storage-fixture'
import { requestDocument } from './requests-fixture'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
const context = { params: Promise.resolve({ id: ids.purchase }) }
const request = (body: unknown = { expected_revision: 1 }, method = 'POST', headers: Record<string, string> = {}) =>
  new Request(`https://example.test/api/procurement/requests/${ids.purchase}?site_id=${ids.site}`, {
    method, headers: { cookie: 'session=fixture', 'content-type': 'application/json', ...headers },
    ...(method !== 'GET' ? { body: JSON.stringify(body) } : {}),
  })
describe('purchase request API trust boundary', () => {
  let from: jest.Mock
  let rpc: jest.Mock
  let serviceRpc: jest.Mock
  let role: string | null
  let restricted: boolean
  let policy: unknown
  let record: Record<string, unknown>
  let lines: Record<string, unknown>[]
  beforeEach(() => {
    jest.clearAllMocks(); role = 'owner'; restricted = false
    const document = defaultPolicyDocument(); document.settings.fallback = { mode: 'none' }; policy = document
    record = { id: ids.purchase, site_id: ids.site, revision: 1, status: 'draft', currency: 'USD', net_amount_minor: 2468, requester_id: ids.owner }
    lines = [{ id: uuid(333), catalog_item_id: uuid(300), category_ids: [], unit_net_minor: 1234, net_amount_minor: 2468, quantity: 2, tax_snapshot: [] }]
    from = jest.fn(table => {
      const result = () => ({ data: table === 'procurement_requests' ? record : table === 'procurement_policy_versions' ? { revision: 7, document: policy } : lines, error: null })
      const query: Record<string, jest.Mock> = {}
      for (const name of ['select', 'eq', 'order', 'limit', 'in', 'range', 'not', 'is', 'ilike']) query[name] = jest.fn(() => query)
      query.maybeSingle = jest.fn(async () => result())
      query.then = jest.fn(resolve => Promise.resolve(result()).then(resolve))
      return query
    })
    rpc = jest.fn(async name => ({ data: name === 'current_user_site_role' ? role : name === 'user_can' ? true : name.includes('location_restrictions') ? restricted : ids.purchase, error: null }))
    serviceRpc = jest.fn(async () => ({ data: ids.purchase, error: null }))
    jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: ids.owner } }, error: null }) }, rpc, from } as never)
    jest.mocked(createServiceClient).mockResolvedValue({ rpc: serviceRpc } as never)
  })
  test('only server policy resolution reaches service-only persistence after authorization', async () => {
    const response = await submit(request(), context)
    expect(response.status).toBe(200)
    expect(createServiceClient).toHaveBeenCalledWith(true)
    expect(serviceRpc).toHaveBeenCalledWith('submit_procurement_request', expect.objectContaining({
      p_actor: ids.owner, p_policy_revision: 7, p_revision: 1, p_site: ids.site,
      p_plan: expect.objectContaining({ status: 'ready', source: 'general', stages: [], authorized: false }),
    }))
    expect(from.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(createServiceClient).mock.invocationCallOrder[0])
  })
  test.each([null, 'collaborator'])('does not construct a service client for unauthorized submitter %s', async value => {
    role = value
    expect((await submit(request(), context)).status).toBe(403)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  test('anonymous, restricted, forged plan and cross-origin submissions cannot reach privileged RPC', async () => {
    expect((await submit(request(undefined, 'POST', { cookie: '' }), context)).status).toBe(401)
    restricted = true
    expect((await submit(request(), context)).status).toBe(403)
    restricted = false
    expect((await submit(request({ expected_revision: 1, resolved_plan: { stages: [] } }), context)).status).toBe(400)
    expect((await submit(request(undefined, 'POST', { origin: 'https://attacker.test' }), context)).status).toBe(403)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  test.each([null, { version: 1, settings: { fallback: { mode: 'garbage' } }, rules: [] }, defaultPolicyDocument()])('missing, malformed and blocking saved policy fails closed %#', async value => {
    policy = value
    expect((await submit(request(), context)).status).toBe(409)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  test('unpriced services and stale revisions never invoke privileged persistence', async () => {
    lines[0].unit_net_minor = null
    expect((await submit(request(), context)).status).toBe(409)
    lines[0].unit_net_minor = 1234; record.revision = 2
    expect((await submit(request(), context)).status).toBe(409)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  test('catalog price, tax and requester overrides are rejected before draft RPC', async () => {
    const document = { ...requestDocument, lines: [{ ...requestDocument.lines[0], unit_net_minor: 1, tax_snapshot: [] }] }
    expect((await create(request({ expected_revision: 0, document }))).status).toBe(400)
    expect((await create(request({ expected_revision: 0, document: requestDocument, requester_id: ids.admin }))).status).toBe(400)
    expect(rpc.mock.calls.some(([name]) => name === 'save_procurement_request')).toBe(false)
  })
  test('valid draft and named member decision remain user-scoped', async () => {
    expect((await create(request({ expected_revision: 0, document: requestDocument }))).status).toBe(200)
    role = 'collaborator'
    const body = { expected_revision: 1, stage_id: uuid(600), decision: 'approve', reason: 'Reviewed' }
    expect((await decide(request(body), context)).status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('user_can', { p_site_id: ids.site, p_command: 'update' })
    expect(rpc).toHaveBeenCalledWith('decide_procurement_request', expect.objectContaining({ p_stage: uuid(600), p_reason: 'Reviewed' }))
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  test('list validates pagination and uses user-scoped data with no-store', async () => {
    const response = await list(request(undefined, 'GET'))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const malformed = new Request(`${request().url}&page=-1`, { headers: { cookie: 'session=x' } })
    expect((await list(malformed)).status).toBe(400)
  })
  test.each(['with_tender', 'without_tender'])('filters %s before pagination and projects only public relationship fields', async sourcing => {
    const response = await list(new Request(`${request().url}&sourcing=${sourcing}&search=office%25`, { headers: { cookie: 'session=x' } }))
    expect(response.status).toBe(200)
    const query = from.mock.results[0].value
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining('tenders:procurement_tenders(id,title,status)'), { count: 'exact' })
    expect(query.ilike).toHaveBeenCalledWith('title', '%office\\%%')
    if (sourcing === 'with_tender') expect(query.not).toHaveBeenCalledWith('tenders', 'is', null)
    else expect(query.is).toHaveBeenCalledWith('tenders', null)
    expect(query.range).toHaveBeenCalledWith(0, 49)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  test('does not expose or infer hidden tender relationships for ordinary request approvers', async () => {
    role = 'collaborator'
    expect((await list(request(undefined, 'GET'))).status).toBe(200)
    expect(from.mock.results[0].value.select.mock.calls[0][0]).not.toContain('procurement_tenders')
    from.mockClear()
    expect((await list(new Request(`${request().url}&sourcing=without_tender`, { headers: { cookie: 'session=x' } }))).status).toBe(403)
    expect(from).not.toHaveBeenCalled()
  })
  test.each(['sourcing=invalid', 'search=' + 'a'.repeat(201), 'sourcing=all&sourcing=with_tender', 'page=0&page=1'])('rejects malformed requisition list filter %s', async query => {
    expect((await list(new Request(`${request().url}&${query}`, { headers: { cookie: 'session=x' } }))).status).toBe(400)
    expect(from).not.toHaveBeenCalled()
  })
})