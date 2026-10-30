/** @jest-environment node */
import { GET } from '@/app/api/procurement/replenishment/route'
import { procurementAccess } from '@/app/api/procurement/http'

jest.mock('@/app/api/procurement/http', () => ({ ...jest.requireActual('@/app/api/procurement/http'), procurementAccess: jest.fn() }))
const site = '11111111-1111-4111-8111-111111111111'
const rule = { id: '22222222-2222-4222-8222-222222222222', name: 'Rule 201' }
const calls: { table: string; methods: Record<string, jest.Mock> }[] = []
beforeEach(() => {
  calls.length = 0
  const from = jest.fn((table: string) => {
    const query: Record<string, jest.Mock> = {}
    for (const key of ['select', 'eq', 'order', 'range', 'in']) query[key] = jest.fn(() => query)
    query.then = jest.fn(resolve => Promise.resolve({ error: null, count: 201, data: table === 'procurement_replenishment_cases'
      ? [{ id: 'case-201', rule_id: rule.id }] : table === 'procurement_replenishment_queue' ? [{ rule_id: rule.id }] : [rule] }).then(resolve))
    calls.push({ table, methods: query }); return query
  })
  jest.mocked(procurementAccess).mockResolvedValue({ siteId: site, supabase: { from } } as never)
})
test('returns page five and fetches queue states and case labels by identity, not another truncated page', async () => {
  const response = await GET(new Request(`https://app.test/api/procurement/replenishment?site_id=${site}&page=5&case_page=5`))
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ rule_count: 201, case_count: 201, page: 5, case_page: 5,
    cases: [{ id: 'case-201', rule_name: 'Rule 201' }] })
  expect(calls[0].methods.range).toHaveBeenCalledWith(200, 249)
  expect(calls[1].methods.range).toHaveBeenCalledWith(200, 249)
  expect(calls[2].methods.in).toHaveBeenCalledWith('rule_id', [rule.id])
  expect(calls[3].methods.in).toHaveBeenCalledWith('id', [rule.id])
  for (const call of calls) expect(call.methods.eq).toHaveBeenCalledWith('site_id', site)
})
test.each(['page=0', 'page=-1', 'page=1&page=2', 'case_page=1.5', 'case_page=1&case_page=2', 'page=1000000', 'offset=200'])('rejects invalid paging %s before reading data', async query => {
  const response = await GET(new Request(`https://app.test/api/procurement/replenishment?site_id=${site}&${query}`))
  expect(response.status).toBe(400)
  expect(calls).toHaveLength(0)
})