/** @jest-environment node */
import { GET as list, POST as create } from '@/app/api/procurement/tenders/route'
import { GET as detail, PUT as update, PATCH as transition } from '@/app/api/procurement/tenders/[id]/route'
import { POST as participant } from '@/app/api/procurement/tenders/[id]/participants/route'
import { POST as portal } from '@/app/api/procurement/tenders/portal/route'
import { createClient } from '@/lib/supabase/server'
import { ids } from './storage-fixture'
import { tenderDocument, supplierId } from './tenders-fixture'
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const context = { params: Promise.resolve({ id: ids.purchase }) }
const request = (body: unknown = {}, method = 'POST', headers: Record<string, string> = {}) => new Request(`https://example.test/api/procurement/tenders?site_id=${ids.site}`, {
  method, headers: { cookie: 'session=fixture', 'content-type': 'application/json', ...headers }, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
})
describe('tender API authorization and validation', () => {
  let rpc: jest.Mock, from: jest.Mock, role: string | null, restricted: boolean, permitted: boolean
  beforeEach(() => {
    jest.clearAllMocks(); role = 'owner'; restricted = false; permitted = true
    rpc = jest.fn(async name => ({ data: name === 'current_user_site_role' ? role : name === 'user_can' ? permitted : name.includes('location_restrictions') ? restricted : name === 'list_procurement_receipt_activity' ? [] : ids.purchase, error: null }))
    from = jest.fn(() => {
      const query: Record<string, jest.Mock> = {}
      for (const name of ['select', 'eq', 'order', 'range', 'ilike']) query[name] = jest.fn(() => query)
      query.then = jest.fn(resolve => Promise.resolve({ data: [], count: 0, error: null }).then(resolve))
      return query
    })
    jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: ids.owner } }, error: null }) }, rpc, from } as never)
  })
  test('authenticated validated writes use user-scoped RPC with trusted site and strict document', async () => {
    const body = { expected_version: 0, document: tenderDocument }
    expect((await create(request(body))).status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('save_procurement_tender', { p_site: ids.site, p_id: null, p_version: 0, p_document: tenderDocument })
    expect((await update(request({ ...body, expected_version: 2 }, 'PUT'), context)).status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('save_procurement_tender', expect.objectContaining({ p_id: ids.purchase, p_version: 2 }))
  })
  test.each([null, 'member'])('denies tenant and non-manager access %s', async value => {
    role = value
    expect((await create(request({ expected_version: 0, document: tenderDocument }))).status).toBe(403)
    expect(rpc.mock.calls.some(([name]) => name === 'save_procurement_tender')).toBe(false)
  })
  test('anonymous, restricted and capability-denied users cannot read or write', async () => {
    expect((await list(request({}, 'GET', { cookie: '' }))).status).toBe(401)
    restricted = true; expect((await list(request({}, 'GET'))).status).toBe(403)
    restricted = false; permitted = false; expect((await create(request({}))).status).toBe(403)
    expect(from).not.toHaveBeenCalled()
  })
  test('forged publisher, status, estimate totals and cross-origin writes are rejected', async () => {
    for (const extra of [{ created_by: ids.admin }, { status: 'published' }, { net_amount_minor: 0 }]) {
      expect((await create(request({ expected_version: 0, document: { ...tenderDocument, ...extra } }))).status).toBe(400)
    }
    expect((await create(request({ expected_version: 0, document: tenderDocument }, 'POST', { origin: 'https://attacker.test' }))).status).toBe(403)
    expect(rpc.mock.calls.some(([name]) => name === 'save_procurement_tender')).toBe(false)
  })
  test('rejects invalid dates, duplicate requirements and inconsistent global opt-in', async () => {
    for (const document of [
      { ...tenderDocument, opening_at: '2000-01-01T00:00:00Z' },
      { ...tenderDocument, requirements: [...tenderDocument.requirements, ...tenderDocument.requirements] },
      { ...tenderDocument, visibility: 'private' },
    ]) expect((await create(request({ expected_version: 0, document }))).status).toBe(400)
  })
  test('transition and invitation are version-pinned; portal configuration excludes client site overrides', async () => {
    expect((await transition(request({ expected_version: 3, action: 'cancel' }, 'PATCH'), context)).status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('transition_procurement_tender', expect.objectContaining({ p_version: 3, p_action: 'cancel', p_site: ids.site }))
    expect((await participant(request({ expected_version: 3, supplier_id: supplierId, status: 'invited' }), context)).status).toBe(200)
    expect((await portal(request({ enabled: true, site_id: ids.otherSite }))).status).toBe(400)
    expect((await portal(request({ enabled: true }))).status).toBe(200)
  })
  test('list is no-store and validates pagination', async () => {
    const response = await list(request({}, 'GET'))
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect((await list(new Request(`${request().url}&page=-1`, { headers: { cookie: 'session=fixture' } }))).status).toBe(400)
  })
  test.each([true, false])('detail reads current-version pending publication with tenant scope: %s', async pending => {
    const approvalQuery: Record<string, jest.Mock> = {}
    for (const name of ['select', 'eq', 'limit']) approvalQuery[name] = jest.fn(() => approvalQuery)
    approvalQuery.then = jest.fn(resolve => Promise.resolve({ data: pending ? [{ id: ids.purchase }] : [], error: null }).then(resolve))
    from.mockImplementation(table => {
      if (table === 'procurement_event_approvals') return approvalQuery
      const query: Record<string, jest.Mock> = {}
      for (const name of ['select', 'eq', 'order']) query[name] = jest.fn(() => query)
      const result = { data: table === 'procurement_tenders' ? { id: ids.purchase, version: 3 } : table === 'procurement_tender_portals' ? null : [], error: null }
      query.maybeSingle = jest.fn(async () => result)
      query.then = jest.fn(resolve => Promise.resolve(result).then(resolve))
      return query
    })
    const result = await detail(request({}, 'GET'), context)
    expect(result.status).toBe(200)
    expect(await result.json()).toMatchObject({ publication_pending: pending })
    expect(rpc).toHaveBeenCalledWith('list_procurement_receipt_activity', { p_site: ids.site, p_tender: ids.purchase })
    for (const [column, value] of Object.entries({ site_id: ids.site, target_id: ids.purchase, target_version: 3, event: 'publication', status: 'pending' })) {
      expect(approvalQuery.eq).toHaveBeenCalledWith(column, value)
    }
    expect(approvalQuery.limit).toHaveBeenCalledWith(1)
  })
  test('does not return a successful empty activity when receipt storage fails', async () => {
    from.mockImplementation(table => {
      const query: Record<string, jest.Mock> = {}
      for (const name of ['select', 'eq', 'order', 'limit']) query[name] = jest.fn(() => query)
      const result = { data: table === 'procurement_tenders' ? { id: ids.purchase, version: 3 } : [], error: null }
      query.maybeSingle = jest.fn(async () => result)
      query.then = jest.fn(resolve => Promise.resolve(result).then(resolve))
      return query
    })
    const original = rpc.getMockImplementation()!
    rpc.mockImplementation(name => name === 'list_procurement_receipt_activity'
      ? { data: null, error: { code: '42883', message: 'private SQL detail' } } : original(name))
    const result = await detail(request({}, 'GET'), context)
    expect(result.status).toBe(503)
    expect(await result.text()).not.toContain('private SQL detail')
  })
})