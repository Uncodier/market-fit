/** @jest-environment node */
import { POST as revalidate } from '@/app/api/procurement/requests/[id]/revalidate/route'
import { POST as submit } from '@/app/api/procurement/requests/[id]/submit/route'
import { POST as publish } from '@/app/api/procurement/tenders/[id]/publish/route'
import { POST as approve } from '@/app/api/procurement/commerce/approvals/route'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { plainPolicy, requestPolicy, planFor, ids, uuid } from './lifecycle-repair-fixture'
import { validatePolicyReferences } from '@/app/api/procurement/policy/validate-references'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
const context = { params: Promise.resolve({ id: ids.purchase }) }
const request = (body: unknown = { expected_revision: 1 }, headers: Record<string, string> = {}) => new Request(
  `https://example.test/api/procurement/requests/${ids.purchase}?site_id=${ids.site}`, {
    method: 'POST', headers: { cookie: 'session=fixture', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  })
let rpc: jest.Mock, serviceRpc: jest.Mock, from: jest.Mock
let role: string | null, restricted: boolean, permission: boolean
let document: ReturnType<typeof plainPolicy>, inherited: { inherited_requirements: unknown[]; minimum_supplier_proposals: number }
let dbError: { code: string; message: string } | null
beforeEach(() => {
  jest.clearAllMocks(); role = 'owner'; restricted = false; permission = true; dbError = null
  document = plainPolicy(); inherited = { inherited_requirements: [], minimum_supplier_proposals: 0 }
  from = jest.fn(table => {
    const result = () => ({ error: null, data: table === 'procurement_policy_versions' ? { revision: 2, document }
      : table === 'procurement_requests' ? { id: ids.purchase, revision: 1, status: 'draft', currency: 'USD', net_amount_minor: 100, requester_id: ids.owner }
        : table === 'procurement_tenders' ? { id: ids.purchase, version: 1, currency: 'USD', net_amount_minor: 100,
          requirements: [{ id: ids.purchase, catalog_item_id: null, quantity: 1, unit_net_minor: 100 }] }
          : table === 'procurement_request_items' ? [{ id: uuid(940), catalog_item_id: null, category_ids: [], unit_net_minor: 100, net_amount_minor: 100, tax_snapshot: [] }]
            : table === 'sites' ? { user_id: ids.owner } : table === 'site_members' ? [] : { id: ids.purchase, status: 'approved' } })
    const query: Record<string, jest.Mock> = {}
    for (const method of ['select', 'eq', 'in', 'order', 'limit']) query[method] = jest.fn(() => query)
    query.maybeSingle = query.single = jest.fn(async () => result())
    query.then = jest.fn(resolve => Promise.resolve(result()).then(resolve))
    return query
  })
  rpc = jest.fn(async name => ({ error: name === 'revalidate_procurement_request' ? dbError : null,
    data: name === 'current_user_site_role' ? role : name === 'user_can' ? permission
      : name.includes('location_restrictions') ? restricted : name === 'procurement_inherited_policy' ? inherited
        : name === 'procurement_commerce_event_context' ? { currency: 'USD', net_amount_minor: 100, supplier_proposals: 1,
          lines: [{ id: ids.purchase, productId: uuid(300), categoryIds: [], netAmountMinor: 100 }], ...inherited } : ids.purchase }))
  serviceRpc = jest.fn(async () => ({ error: null, data: ids.purchase }))
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: ids.owner } }, error: null }) }, rpc, from } as never)
  jest.mocked(createServiceClient).mockResolvedValue({ rpc: serviceRpc } as never)
})

test('revalidation is explicit, expected-revision, authorized user-scoped persistence', async () => {
  const response = await revalidate(request(), context)
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(rpc).toHaveBeenCalledWith('revalidate_procurement_request', { p_site: ids.site, p_id: ids.purchase, p_revision: 1 })
  expect(serviceRpc).not.toHaveBeenCalled()
})
test.each([null, 'collaborator'])('revalidation denies non-manager %s', async value => {
  role = value
  expect((await revalidate(request(), context)).status).toBe(403)
  expect(rpc.mock.calls.some(([name]) => name === 'revalidate_procurement_request')).toBe(false)
})
test('denies anonymous, restricted, disabled update, foreign-origin, malformed and client state overrides', async () => {
  expect((await revalidate(request(undefined, { cookie: '' }), context)).status).toBe(401)
  restricted = true; expect((await revalidate(request(), context)).status).toBe(403); restricted = false
  permission = false; expect((await revalidate(request(), context)).status).toBe(403); permission = true
  expect((await revalidate(request(undefined, { origin: 'https://foreign.test' }), context)).status).toBe(403)
  for (const body of [{ expected_revision: 0 }, { expected_revision: 1, status: 'approved' }, { expected_revision: 1, document: {} }]) {
    expect((await revalidate(request(body), context)).status).toBe(400)
  }
  expect(rpc.mock.calls.some(([name]) => name === 'revalidate_procurement_request')).toBe(false)
})
test('stale and committed-order DB conflicts remain safe 409 errors', async () => {
  dbError = { code: '40001', message: 'Sensitive database content' }
  const response = await revalidate(request(), context)
  expect(response.status).toBe(409)
  expect(await response.text()).not.toContain(dbError.message)
})
test('submit ignores only unchanged archived references from its exact saved policy snapshot', async () => {
  document = requestPolicy('award')
  document.rules[0].status = 'archived'
  document.rules[0].scope.requesterIds = [ids.foreign]
  expect((await submit(request(), context)).status).toBe(200)
  expect(from.mock.calls.some(([table]) => table === 'site_members')).toBe(false)
  expect(serviceRpc).toHaveBeenCalledWith('submit_procurement_request', expect.objectContaining({ p_plan: expect.objectContaining({ requirements: [] }) }))
  serviceRpc.mockClear()
  document.rules[0].status = 'active'
  expect((await submit(request(), context)).status).toBe(409)
  expect(serviceRpc).not.toHaveBeenCalled()
})
test('archived exemption rejects edited archived rules, arbitrary previous definitions and reactivation', async () => {
  const previous = requestPolicy('award'); previous.rules[0].status = 'archived'; previous.rules[0].scope.requesterIds = [ids.foreign]
  const client = await createClient()
  expect(await validatePolicyReferences(client, ids.site, previous, previous)).toBe(true)
  const changed = structuredClone(previous); changed.rules[0].name = 'Edited'
  expect(await validatePolicyReferences(client, ids.site, changed, previous)).toBe(false)
  expect(await validatePolicyReferences(client, ids.site, previous, plainPolicy())).toBe(false)
  changed.rules[0].status = 'active'
  expect(await validatePolicyReferences(client, ids.site, changed, previous)).toBe(false)
  expect((await submit(request({ expected_revision: 1, ignoredRuleIds: ['request-rule'] }), context)).status).toBe(400)
})
test.each(['award', 'order'])('API %s honors inherited requirements and minimum counts rather than event-only rules', async event => {
  const body = { target_id: ids.purchase, expected_version: 1, event }
  inherited.minimum_supplier_proposals = 3
  expect((await approve(request(body))).status).toBe(409)
  inherited.minimum_supplier_proposals = 0
  inherited.inherited_requirements = planFor(requestPolicy('award')).requirements
  expect((await approve(request(body))).status).toBe(409)
  expect(serviceRpc).not.toHaveBeenCalled()
  inherited.inherited_requirements = []; inherited.minimum_supplier_proposals = 1
  expect((await approve(request(body))).status).toBe(200)
  expect(serviceRpc).toHaveBeenCalledWith('create_procurement_commerce_approval', expect.objectContaining({ p_plan: expect.objectContaining({ minimumSupplierProposals: 1 }) }))
})
test('publication loads request policy with user-scoped API context before privileged release', async () => {
  inherited.inherited_requirements = planFor(requestPolicy('participation')).requirements
  expect((await publish(request({ expected_version: 1 }), context)).status).toBe(409)
  expect(serviceRpc).not.toHaveBeenCalled()
  expect(rpc).toHaveBeenCalledWith('procurement_inherited_policy', { p_site: ids.site, p_tender: ids.purchase, p_event: 'publication' })
  inherited.inherited_requirements = []; inherited.minimum_supplier_proposals = 3
  expect((await publish(request({ expected_version: 1 }), context)).status).toBe(200)
})