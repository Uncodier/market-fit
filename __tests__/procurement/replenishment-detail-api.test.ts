/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GET } from '@/app/api/procurement/replenishment/[id]/route'
import { createClient, createServiceClient } from '@/lib/supabase/server'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))

const site = '11111111-1111-4111-8111-111111111111'
const id = '22222222-2222-4222-8222-222222222222'
const other = '33333333-3333-4333-8333-333333333333'
const productId = '44444444-4444-4444-8444-444444444444'
const locationId = '55555555-5555-4555-8555-555555555555'
type Row = Record<string, unknown>
type Call = { table: string; methods: Record<string, jest.Mock>; columns: string }
const rule = { id, site_id: site, name: 'Paper stock', catalog_item_id: productId, location_id: locationId,
  minimum: 10, target: 40, minimum_order: 6, order_multiple: 6, enabled: true, action: 'draft', version: 2 }
let rows: Record<string, Row[]>, calls: Call[], rpc: jest.Mock, from: jest.Mock
let failure: string | undefined, missingCount: string | undefined

function query(table: string) {
  const call: Call = { table, columns: '', methods: {} }
  const filters: [string, unknown][] = []
  let range: [number, number] | undefined, single = false, count = false, linked = false
  const methods = call.methods
  methods.select = jest.fn((columns, options) => { call.columns = columns; count = options?.count === 'exact'; return methods })
  methods.eq = jest.fn((key, value) => { filters.push([key, value]); return methods })
  methods.not = jest.fn(() => { linked = true; return methods })
  methods.order = jest.fn(() => methods)
  methods.range = jest.fn((start, end) => { range = [start, end]; return methods })
  methods.maybeSingle = jest.fn(() => { single = true; return methods })
  methods.then = jest.fn(resolve => {
    const kind = linked ? 'requests' : table
    let selected = (rows[table] ?? []).filter(row => filters.every(([key, value]) => key === 'request.site_id'
      ? rows.procurement_requests.some(request => request.id === row.request_id && request.site_id === value)
      : row[key] === value))
    if (linked) selected = selected.filter(row => row.request_id != null).map(row => ({
      request: Object.fromEntries(Object.entries(rows.procurement_requests.find(request => request.id === row.request_id)!)
        .filter(([key]) => ['id', 'title', 'status', 'currency', 'net_amount_minor', 'revision'].includes(key))),
    }))
    const total = selected.length
    if (range) selected = selected.slice(range[0], range[1] + 1)
    return Promise.resolve({ data: single ? selected[0] ?? null : selected,
      count: count && missingCount !== kind ? total : null,
      error: failure === kind ? { message: 'Sensitive database detail' } : null }).then(resolve)
  })
  calls.push(call)
  return methods
}

const request = (queryString = `site_id=${site}`, cookie = 'session=x') => new Request(
  `https://app.test/api/procurement/replenishment/${id}?${queryString}`, { headers: { cookie } },
)
const get = (queryString?: string, ruleId = id) => GET(request(queryString), { params: Promise.resolve({ id: ruleId }) })

beforeEach(() => {
  jest.clearAllMocks()
  calls = []; failure = undefined; missingCount = undefined
  rows = {
    procurement_replenishment_rules: [rule],
    procurement_replenishment_queue: [{ site_id: site, rule_id: id, generation: 3, evaluated_generation: 2 }],
    procurement_replenishment_cases: [], procurement_requests: [],
    catalog_items: [{ id: productId, site_id: site, name: 'Paper' }],
    locations: [{ id: locationId, site_id: site, name: 'Warehouse' }],
  }
  for (let index = 0; index < 120; index++) {
    const requestId = index % 4 === 0 ? null : `request-${index}`
    rows.procurement_replenishment_cases.push({ id: `case-${index}`, site_id: site, rule_id: id,
      rule_version: 1, catalog_item_id: productId, location_id: locationId, request_id: requestId,
      status: index % 2 ? 'closed' : 'open', observed_quantity: 5, quantity: 36, action: requestId ? 'draft' : 'alert',
      created_by: other, created_at: '2026-10-28T00:00:00Z', closed_by: index % 2 ? other : null,
      closed_at: index % 2 ? '2026-10-29T00:00:00Z' : null, close_reason: index % 2 ? 'Reconciled' : null })
    if (requestId) rows.procurement_requests.push({ id: requestId, site_id: site, title: `Paper ${index}`,
      status: 'draft', currency: 'USD', net_amount_minor: 3600, revision: 1 })
  }
  from = jest.fn(query)
  rpc = jest.fn(async name => ({ data: name === 'current_user_site_role' ? 'owner' : false, error: null }))
  jest.mocked(createClient).mockResolvedValue({ from, rpc,
    auth: { getUser: async () => ({ data: { user: { id: other } }, error: null }) } } as never)
})

test('returns scoped detail, provenance and closed-case request links with independent exact pages', async () => {
  const response = await get(`site_id=${site}&case_page=3&request_page=2`)
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  const body = await response.json()
  expect(body).toMatchObject({ rule: { ...rule, catalog_item_name: 'Paper', location_name: 'Warehouse' },
    queue: { rule_id: id, generation: 3 }, case_count: 120, case_page: 3, request_count: 90, request_page: 2, page_size: 50 })
  expect(body.cases).toHaveLength(20)
  expect(body.cases[1]).toMatchObject({ id: 'case-101', rule_version: 1, created_by: other,
    status: 'closed', closed_by: other, close_reason: 'Reconciled', request_id: 'request-101' })
  expect(body.requests).toHaveLength(40)
  expect(body.requests[0]).toEqual({ id: 'request-67', title: 'Paper 67', status: 'draft', currency: 'USD', net_amount_minor: 3600, revision: 1 })
  expect(calls[2].methods.range).toHaveBeenCalledWith(100, 149)
  expect(calls[3].methods.range).toHaveBeenCalledWith(50, 99)
  for (const call of calls.slice(0, 4)) {
    expect(call.methods.eq).toHaveBeenCalledWith('site_id', site)
    expect(call.methods.eq).toHaveBeenCalledWith(call.table.endsWith('_rules') ? 'id' : 'rule_id', id)
  }
  for (const call of [calls[2], calls[3]]) {
    expect(call.methods.select).toHaveBeenCalledWith(expect.any(String), { count: 'exact' })
    expect(call.methods.order.mock.calls).toEqual([['created_at', { ascending: false }], ['id']])
    expect(call.methods.eq).not.toHaveBeenCalledWith('status', 'open')
  }
  expect(calls[3].columns).toContain('procurement_requests!procurement_replenishment_cases_site_id_request_id_fkey!inner')
  expect(calls[3].methods.not).toHaveBeenCalledWith('request_id', 'is', null)
  expect(calls[3].methods.eq).toHaveBeenCalledWith('request.site_id', site)
  expect(from).not.toHaveBeenCalledWith('procurement_requests')
  expect(createClient).toHaveBeenCalledWith(true)
  expect(createServiceClient).not.toHaveBeenCalled()
})

test('excludes another rule and tenant from cases, requests, queue and reference names', async () => {
  for (const foreignCase of [{ ...rows.procurement_replenishment_cases[1], id: 'other-rule', rule_id: other },
    { ...rows.procurement_replenishment_cases[1], id: 'other-site', site_id: other }]) rows.procurement_replenishment_cases.unshift(foreignCase)
  rows.procurement_replenishment_queue.unshift({ site_id: other, rule_id: id, generation: 999 })
  rows.catalog_items.unshift({ id: productId, site_id: other, name: 'Secret product' })
  rows.locations.unshift({ id: locationId, site_id: other, name: 'Secret location' })
  const body = await (await get()).json()
  expect(body.case_count).toBe(120)
  expect(body.request_count).toBe(90)
  expect(JSON.stringify(body)).not.toMatch(/other-rule|other-site|Secret/)
  expect(body.queue.generation).toBe(3)
  for (const call of calls.slice(4)) expect(call.methods.eq).toHaveBeenCalledWith('site_id', site)
  expect(calls[4].methods.eq).toHaveBeenCalledWith('id', productId)
  expect(calls[5].methods.eq).toHaveBeenCalledWith('id', locationId)
})

test('returns empty beyond-end pages without losing exact totals and permits absent optional references', async () => {
  rows.procurement_replenishment_queue = []; rows.catalog_items = []; rows.locations = []
  const body = await (await get(`site_id=${site}&case_page=999999&request_page=999999`)).json()
  expect(body).toMatchObject({ queue: null, rule: { catalog_item_name: null, location_name: null },
    cases: [], requests: [], case_count: 120, request_count: 90, case_page: 999999, request_page: 999999 })
})

test.each(['missing', 'foreign'])('returns 404 for %s rule without reading any history', async kind => {
  rows.procurement_replenishment_rules = kind === 'missing' ? [] : [{ ...rule, site_id: other }]
  expect((await get()).status).toBe(404)
  expect(calls).toHaveLength(1)
})

test.each(['', 'not-a-uuid', '22222222-2222-4222-8222-22222222222g'])('rejects malformed rule identifier %s', async value => {
  expect((await get(undefined, value)).status).toBe(400)
  expect(from).not.toHaveBeenCalled()
})

test.each(['site_id=bad', '', `site_id=${site}&site_id=${other}`, `site_id=${site}&site_id=${site}`])('rejects malformed workspace query %s', async queryString => {
  expect((await get(queryString)).status).toBe(400)
  expect(from).not.toHaveBeenCalled()
})

test.each(['case_page=0', 'case_page=-1', 'case_page=1.5', 'case_page=01', 'case_page=', 'case_page=1e2',
  'case_page=1000000', 'case_page=1&case_page=2', 'request_page=0', 'request_page=-1', 'request_page=1.5',
  'request_page=01', 'request_page=', 'request_page=%201', 'request_page=1e2', 'request_page=1000000',
  'request_page=1&request_page=2', 'page=1', 'page_size=100', 'status=open', 'rule_id=other'])('rejects invalid paging %s', async paging => {
  expect((await get(`site_id=${site}&${paging}`)).status).toBe(400)
  expect(from).not.toHaveBeenCalled()
})

test('rejects anonymous and invalid sessions', async () => {
  expect((await GET(request(undefined, ''), { params: Promise.resolve({ id }) })).status).toBe(401)
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never)
  expect((await get()).status).toBe(401)
  expect(from).not.toHaveBeenCalled()
})

test.each(['collaborator', null])('denies role %s before querying data', async role => {
  rpc.mockResolvedValue({ data: role, error: null })
  const response = await get()
  expect(response.status).toBe(403)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(from).not.toHaveBeenCalled()
})

test.each(['procurement_replenishment_rules', 'procurement_replenishment_queue', 'procurement_replenishment_cases',
  'requests', 'catalog_items', 'locations'])('fails closed and sanitizes errors from %s', async table => {
  failure = table
  const response = await get()
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain('Sensitive database detail')
})

test.each(['procurement_replenishment_cases', 'requests'])('does not report a fabricated total when %s exact count is missing', async table => {
  missingCount = table
  expect((await get()).status).toBe(503)
})

test('request pagination relies on the existing unique request link and same-site composite FK', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261028010000_procurement_replenishment.sql'), 'utf8')
  expect(sql).toMatch(/request_id uuid UNIQUE/)
  expect(sql).toContain('FOREIGN KEY(site_id,request_id) REFERENCES public.procurement_requests(site_id,id)')
})