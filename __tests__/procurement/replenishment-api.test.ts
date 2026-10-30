/** @jest-environment node */
import { GET, POST } from '@/app/api/procurement/replenishment/route'
import { POST as evaluate } from '@/app/api/procurement/replenishment/[id]/evaluate/route'
import { POST as processQueue } from '@/app/api/procurement/replenishment/process/route'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { replenishmentDocumentSchema } from '@/app/purchases/procurement/replenishment/schema'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
const site = '11111111-1111-4111-8111-111111111111'
const id = '22222222-2222-4222-8222-222222222222'
const rule = { name: 'Paper stock', catalog_item_id: id, location_id: site, minimum: 10, target: 40, minimum_order: 6, order_multiple: 6, enabled: true, action: 'draft' }
const request = (body: unknown = {}, method = 'POST', extra = {}) => new Request(`https://example.test/api/procurement/replenishment?site_id=${site}`, {
  method, headers: { cookie: 'session=x', 'Content-Type': 'application/json', ...extra }, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
})
describe('replenishment API', () => {
  let rpc: jest.Mock, from: jest.Mock
  beforeEach(() => {
    jest.clearAllMocks()
    rpc = jest.fn(async name => ({ data: name === 'current_user_site_role' ? 'owner' : name.includes('location') ? false : id, error: null }))
    from = jest.fn(() => {
      const query: Record<string, jest.Mock> = {}
      for (const method of ['select', 'eq', 'order', 'limit', 'range', 'in']) query[method] = jest.fn(() => query)
      query.then = jest.fn(resolve => Promise.resolve({ data: [], error: null, count: 0 }).then(resolve)); return query
    })
    jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id } }, error: null }) }, rpc, from } as never)
  })
  test('validates target above minimum and never accepts gross/payment fields', () => {
    expect(replenishmentDocumentSchema.safeParse(rule).success).toBe(true)
    expect(replenishmentDocumentSchema.safeParse({ ...rule, target: 10 }).success).toBe(false)
    expect(replenishmentDocumentSchema.safeParse({ ...rule, paid: true }).success).toBe(false)
  })
  test('lists rules and persisted cases through user-scoped access', async () => {
    expect((await GET(request({}, 'GET'))).status).toBe(200)
    expect(from).toHaveBeenCalledWith('procurement_replenishment_cases')
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  test('saves validated configuration and delegates live quantities to the database', async () => {
    expect((await POST(request({ id: null, expected_version: 0, document: rule }))).status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('save_procurement_replenishment_rule', expect.objectContaining({ p_site: site, p_version: 0, p_document: rule }))
    const ctx = { params: Promise.resolve({ id }) }
    expect((await evaluate(request({ on_hand: 0 }), ctx)).status).toBe(400)
    expect((await evaluate(request(), ctx)).status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('evaluate_procurement_replenishment_rule', { p_site: site, p_rule: id })
  })
  test('denies anonymous, ordinary members and cross-origin mutations', async () => {
    expect((await POST(request({}, 'POST', { cookie: '' }))).status).toBe(401)
    rpc.mockResolvedValue({ data: 'collaborator', error: null })
    expect((await POST(request())).status).toBe(403)
    rpc.mockImplementation(async name => ({ data: name === 'current_user_site_role' ? 'owner' : false, error: null }))
    expect((await POST(request({}, 'POST', { origin: 'https://evil.test' }))).status).toBe(403)
  })
  test('worker is unavailable without secret and never elevates unauthorized requests', async () => {
    const original = process.env.PROCUREMENT_REPLENISHMENT_WORKER_SECRET
    try {
      delete process.env.PROCUREMENT_REPLENISHMENT_WORKER_SECRET
      expect((await processQueue(new Request('https://example.test/process', { method: 'POST' }))).status).toBe(503)
      process.env.PROCUREMENT_REPLENISHMENT_WORKER_SECRET = 'x'.repeat(40)
      expect((await processQueue(new Request('https://example.test/process', { method: 'POST' }))).status).toBe(401)
      expect(createServiceClient).not.toHaveBeenCalled()
      const worker = jest.fn(async () => ({ data: { processed: 1, failed: 0, busy: false }, error: null }))
      jest.mocked(createServiceClient).mockResolvedValue({ rpc: worker } as never)
      expect((await processQueue(new Request('https://example.test/process', { method: 'POST', headers: { Authorization: `Bearer ${'x'.repeat(40)}` } }))).status).toBe(200)
      expect(worker).toHaveBeenCalledWith('process_procurement_replenishment', { p_limit: 1 })
      expect(worker).toHaveBeenCalledTimes(25)
      expect(createServiceClient).toHaveBeenCalledWith(true, { access: 'system' })
    } finally {
      if (original === undefined) delete process.env.PROCUREMENT_REPLENISHMENT_WORKER_SECRET
      else process.env.PROCUREMENT_REPLENISHMENT_WORKER_SECRET = original
    }
  })
})