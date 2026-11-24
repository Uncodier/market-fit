import { getLeads, getLeadsWithCount, searchLeadsWithCount } from "@/app/leads/read-actions"
import { createClient } from "@/lib/supabase/server"
import { createDemoMockClient } from "@/lib/demo-data/mock-client"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const siteId = "10000000-0000-4000-8000-000000000001"
const segmentId = "20000000-0000-4000-8000-000000000001"

type QueryResult = { data: unknown[] | null; count: number | null; error: unknown; status?: number }

function userScopedClient(...results: QueryResult[]) {
  const nextResult = jest.fn(() => results.length ? results.shift()! : { data: [], count: 0, error: null })
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    abortSignal: jest.fn().mockReturnThis(),
    retry: jest.fn().mockReturnThis(),
    then: (resolve: (result: QueryResult) => void) => resolve(nextResult()),
  }
  const from = jest.fn(() => query)
  jest.mocked(createClient).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createClient>>)
  return { from, query }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

it("adds a segment equality filter without removing the site filter from list or search", async () => {
  const { from, query } = userScopedClient()
  await expect(getLeads(siteId, segmentId)).resolves.toEqual({ leads: [] })
  await expect(searchLeadsWithCount(siteId, "manufacturing", 200, 0, segmentId)).resolves.toEqual({ leads: [], totalCount: 0 })
  expect(from.mock.calls).toHaveLength(2)
  expect(from).toHaveBeenCalledWith("leads")
  expect(query.eq.mock.calls).toEqual([
    ["site_id", siteId], ["segment_id", segmentId],
    ["site_id", siteId], ["segment_id", segmentId],
  ])
  expect(query.range).toHaveBeenCalledWith(0, 199)
  expect(query.select.mock.calls[0][1]).toBeUndefined()
})

it("fails closed for malformed segment ids without running a broad list or search", async () => {
  await expect(getLeads(siteId, "")).resolves.toEqual({ leads: [] })
  await expect(getLeadsWithCount(siteId, "invalid")).resolves.toEqual({ leads: [], totalCount: 0 })
  await expect(searchLeadsWithCount(siteId, "manufacturing", 200, 0, "invalid")).resolves.toEqual({ leads: [], totalCount: 0 })
  await expect(getLeadsWithCount("invalid", segmentId)).resolves.toMatchObject({ error: 'Invalid lead site' })
  await expect(searchLeadsWithCount(siteId, "manufacturing", 1001)).resolves.toMatchObject({ error: 'Invalid lead search' })
  expect(createClient).not.toHaveBeenCalled()
})

it("gets the site and segment list and exact total under one user-scoped request", async () => {
  const lead = { id: "example", origin: "lead_generation_workflow" }
  const { from, query } = userScopedClient({ data: [lead], count: 151, error: null })
  await expect(getLeadsWithCount(siteId, segmentId)).resolves.toEqual({
    leads: [{ ...lead, origin: "Makinari" }], totalCount: 151,
  })
  expect(createClient).toHaveBeenCalledTimes(1)
  expect(from.mock.calls).toEqual([["leads"]])
  expect(query.select).toHaveBeenCalledWith(expect.stringContaining("companies(name)"), { count: "exact" })
  expect(query.eq.mock.calls).toEqual([["site_id", siteId], ["segment_id", segmentId]])
  expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false })
})

it("distinguishes an unknown total from a real zero and a failed read", async () => {
  userScopedClient({ data: [], count: null, error: null })
  await expect(getLeadsWithCount(siteId)).resolves.toEqual({ leads: [], totalCount: null })
  userScopedClient()
  await expect(getLeadsWithCount(siteId)).resolves.toEqual({ leads: [], totalCount: 0 })
  userScopedClient({ data: null, count: null, error: { code: "42P01" } })
  await expect(getLeadsWithCount(siteId)).resolves.toEqual({ error: "Error loading leads", leads: [], totalCount: null })
})

it.each(['list', 'search'] as const)('retries a %s timeout exactly once with the same scope and no count', async kind => {
  const row = { id: 'example', origin: 'lead_generation_workflow' }
  const { from, query } = userScopedClient(
    { data: null, count: null, error: { code: '57014' }, status: 500 },
    { data: [row], count: 1, error: null, status: 200 },
  )
  const read = kind === 'search'
    ? searchLeadsWithCount(siteId, 'manufacturing', 200, 40, segmentId)
    : getLeadsWithCount(siteId, segmentId)
  await expect(read).resolves.toEqual({ leads: [{ ...row, origin: 'Makinari' }], totalCount: null })
  expect(createClient).toHaveBeenCalledTimes(1)
  expect(from.mock.calls).toEqual([['leads'], ['leads']])
  const columns = query.select.mock.calls[0][0]
  expect(query.select.mock.calls).toEqual([[columns, { count: 'exact' }], [columns, undefined]])
  const filters = [['site_id', siteId], ['segment_id', segmentId]]
  expect(query.eq.mock.calls).toEqual([...filters, ...filters])
  expect(query.order.mock.calls).toEqual(Array(2).fill(['created_at', { ascending: false }]))
  expect(query.retry.mock.calls).toEqual([[false], [false]])
  expect(query.abortSignal.mock.calls).toHaveLength(2)
  expect(query.abortSignal.mock.calls[0][0]).not.toBe(query.abortSignal.mock.calls[1][0])
  if (kind === 'search') {
    expect(query.or).toHaveBeenCalledTimes(2)
    expect(query.or.mock.calls[0]).toEqual(query.or.mock.calls[1])
    expect(query.range.mock.calls).toEqual([[40, 239], [40, 239]])
  }
})

it.each([[401, 'PGRST301', 'Not authenticated'], [403, '42501', 'Forbidden'], [504, 'PGRST003', 'Error loading leads']])(
  'does not double-query on non-timeout HTTP %s', async (status, code, message) => {
    const { from } = userScopedClient({ data: null, count: null, error: { code }, status })
    await expect(getLeadsWithCount(siteId)).resolves.toEqual({ leads: [], totalCount: null, error: message })
    expect(from).toHaveBeenCalledTimes(1)
  },
)

it('uses the counted list in the existing demo client without relying on the PostgREST retry method', async () => {
  jest.mocked(createClient).mockResolvedValue(createDemoMockClient('demo-habituall'))
  const list = await getLeads('demo-habituall')
  expect(list.error).toBeUndefined()
  expect(list.leads?.length).toBeGreaterThan(0)
  await expect(getLeadsWithCount('demo-habituall')).resolves.toEqual({
    leads: list.leads, totalCount: list.leads?.length,
  })
})

it('stops after the bounded fallback and does not reinterpret a denial or timeout as an empty list', async () => {
  const timeout = { data: null, count: null, error: { code: '57014' }, status: 500 }
  const denied = { data: null, count: null, error: { code: '42501' }, status: 403 }
  for (const failure of [denied, timeout]) {
    const { from } = userScopedClient(timeout, failure)
    await expect(getLeadsWithCount(siteId)).resolves.toEqual({
      leads: [], totalCount: null, error: failure === denied ? 'Forbidden' : 'Error loading leads',
    })
    expect(from).toHaveBeenCalledTimes(2)
  }
})