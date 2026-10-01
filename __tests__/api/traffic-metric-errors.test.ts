/** @jest-environment node */

import { NextRequest, NextResponse } from "next/server"
import { GET as visits } from "@/app/api/traffic/visits/route"
import { GET as sessionTime } from "@/app/api/traffic/session-time/route"
import { GET as leadConversion } from "@/app/api/traffic/lead-conversion/route"
import { GET as clientConversion } from "@/app/api/traffic/client-conversion/route"
import { createServiceClient } from "@/lib/supabase/server"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { normalizedRequestCacheKey, readThroughJsonCache } from "@/lib/redis/json-cache"

jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("@/lib/auth/api-analytics-access", () => ({ requireAnalyticsAccess: jest.fn() }))
jest.mock("@/lib/redis/json-cache", () => ({ normalizedRequestCacheKey: jest.fn(), readThroughJsonCache: jest.fn() }))

type QueryResult = { data: unknown[] | null; error: { message: string } | null; count?: number | null }
type Step = { table: string; result: QueryResult }
type CachedResponse = { body: string; headers: [string, string][]; status: number; statusText: string }
const access = requireAnalyticsAccess as jest.Mock
const service = createServiceClient as jest.Mock
const normalizedKey = normalizedRequestCacheKey as jest.Mock
const cache = readThroughJsonCache as jest.Mock
const stored = new Map<string, CachedResponse>()
const privateDetail = "private database connection detail"
const failed: QueryResult = { data: null, count: null, error: { message: privateDetail } }
const rows = (data: unknown[] = []): QueryResult => ({ data, error: null })
const count = (count: number): QueryResult => ({ data: null, count, error: null })
const step = (table: string, result: QueryResult): Step => ({ table, result })
const lead = (id: string) => ({ id, created_at: "2026-09-02" })
const sale = (lead_id: string) => ({ lead_id })
const routes = [
  { name: "visits", handler: visits, message: "Unable to load visits report", expected: { actual: 12, percentChange: 50 },
    steps: [step("visitor_sessions", count(12)), step("visitor_sessions", count(8))] },
  { name: "session-time", handler: sessionTime, message: "Unable to load session time report", expected: { actual: 120, percentChange: 100 },
    steps: [step("visitor_sessions", rows([{ duration: 120 }])), step("visitor_sessions", rows([{ duration: 60 }]))] },
  { name: "lead-conversion", handler: leadConversion, message: "Unable to load lead conversion report", expected: { actual: 50, percentChange: 100 },
    steps: [step("visitor_sessions", rows([{ visitor_id: "v1", lead_id: "l1" }, { visitor_id: "v2", lead_id: null }])),
      step("visitor_sessions", rows([{ visitor_id: "v1", lead_id: null }, { visitor_id: "v2", lead_id: null }]))] },
  { name: "client-conversion", handler: clientConversion, message: "Unable to load client conversion report", expected: { actual: 50, percentChange: -50 },
    steps: [step("leads", rows([lead("l1"), lead("l2")])), step("sales", rows([sale("l1")])),
      step("leads", rows([lead("l3")])), step("sales", rows([sale("l3")]))] },
]

function request(name: string, overrides: Record<string, string> = {}) {
  return new NextRequest(`http://localhost/api/traffic/${name}?${new URLSearchParams({
    siteId: "site-a", segmentId: "all", startDate: "2026-09-01", endDate: "2026-09-29", ...overrides,
  })}`)
}

function database(steps: Step[]) {
  const queries: Array<{ table: string; eq: jest.Mock; gte: jest.Mock; lte: jest.Mock; range: jest.Mock }> = []
  const from = jest.fn((table: string) => {
    const next = steps[queries.length]
    if (!next || next.table !== table) throw new Error("Unexpected test query")
    const query = {
      table, select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(), lte: jest.fn().mockReturnThis(), range: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(), not: jest.fn().mockReturnThis(),
      then: (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(next.result).then(resolve, reject),
    }
    queries.push(query)
    return query
  })
  service.mockResolvedValue({ from })
  return { from, queries }
}

beforeEach(() => {
  jest.clearAllMocks()
  stored.clear()
  access.mockResolvedValue({ siteId: "site-a", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-29"), userId: "session-user" })
  normalizedKey.mockImplementation(async (namespace: string, req: Request) => `${namespace}:${new URL(req.url).searchParams}`)
  cache.mockImplementation(async ({ key, compute }: { key: string; compute: () => Promise<CachedResponse> }) => {
    if (stored.has(key)) return { status: "hit", value: stored.get(key) }
    const value = await compute()
    stored.set(key, value)
    return { status: "computed", value }
  })
  jest.spyOn(console, "log").mockImplementation(() => {})
  jest.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => jest.restoreAllMocks())

async function expectFailure(response: Response, message: string) {
  expect(response.status).toBe(500)
  expect(response.ok).toBe(false)
  expect(await response.json()).toEqual({ error: message })
  expect(stored.size).toBe(0)
  expect(JSON.stringify((console.log as jest.Mock).mock.calls)).not.toContain(privateDetail)
  expect(JSON.stringify((console.error as jest.Mock).mock.calls)).not.toContain(privateDetail)
}

describe.each(routes)("traffic $name metric", ({ name, handler, message, expected, steps }) => {
  it("accepts session authorization without userId and keeps the successful formula", async () => {
    const db = database(steps)
    const req = request(name)
    expect(req.nextUrl.searchParams.has("userId")).toBe(false)
    const response = await handler(req)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ...expected, periodType: "monthly" })
    expect(access).toHaveBeenCalledWith(req)
    expect(access.mock.invocationCallOrder[0]).toBeLessThan(cache.mock.invocationCallOrder[0])
    expect(cache.mock.invocationCallOrder[0]).toBeLessThan(service.mock.invocationCallOrder[0])
    expect(db.queries).toHaveLength(steps.length)
    expect(db.queries[0].eq).toHaveBeenCalledWith("site_id", "site-a")
    expect(db.queries[0].gte).toHaveBeenCalledWith("created_at", "2026-09-01")
    expect(db.queries[0].lte).toHaveBeenCalledWith("created_at", "2026-09-29")
    expect(normalizedKey).toHaveBeenCalledWith(`analytics:traffic:${name}:v2`, expect.any(Request))
    expect(stored.size).toBe(1)
  })

  it.each([401, 403])("returns session denial %i without userId before cache or service access", async status => {
    database(steps)
    access.mockResolvedValue({ error: NextResponse.json({ error: "Access denied" }, { status }) })
    const req = request(name)
    const response = await handler(req)
    expect(req.nextUrl.searchParams.has("userId")).toBe(false)
    expect(response.status).toBe(status)
    expect(access).toHaveBeenCalledWith(req)
    expect(service).not.toHaveBeenCalled()
    expect(normalizedKey).not.toHaveBeenCalled()
    expect(cache).not.toHaveBeenCalled()
  })

  it("retains validated filter rejection before elevated access", async () => {
    database(steps)
    access.mockResolvedValue({ error: NextResponse.json({ error: "Invalid date range" }, { status: 400 }) })
    expect((await handler(request(name, { startDate: "invalid" }))).status).toBe(400)
    expect(service).not.toHaveBeenCalled()
    expect(cache).not.toHaveBeenCalled()
  })

  it("keeps genuine empty results as zero", async () => {
    database(name === "visits" ? [step("visitor_sessions", count(0)), step("visitor_sessions", count(0))]
      : name === "client-conversion" ? [step("leads", rows())]
      : [step("visitor_sessions", rows()), step("visitor_sessions", rows())])
    const response = await handler(request(name))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ actual: 0, percentChange: 0, periodType: "monthly" })
  })

  it.each(steps.map(({ table }, index) => ({ table, index })))("rejects query $index ($table) failure, not zero or partial success", async ({ index }) => {
    const db = database(steps.map((entry, i) => i === index ? { ...entry, result: failed } : entry))
    await expectFailure(await handler(request(name)), message)
    expect(db.queries).toHaveLength(index + 1)
  })

  it("sanitizes thrown service errors instead of returning zero", async () => {
    service.mockRejectedValueOnce(new Error(privateDetail))
    await expectFailure(await handler(request(name)), message)
  })

  it("does not cache a failure and lets the same request recover", async () => {
    database([{ ...steps[0], result: failed }])
    await expectFailure(await handler(request(name)), message)
    database(steps)
    const response = await handler(request(name))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ...expected, periodType: "monthly" })
    expect(service).toHaveBeenCalledTimes(2)
  })

  it("does not read successful false-zero entries from the old namespace", async () => {
    stored.set(`analytics:traffic:${name}:${request(name).nextUrl.searchParams}`, {
      body: JSON.stringify({ actual: 0, percentChange: 0, periodType: "monthly" }), headers: [], status: 200, statusText: "OK",
    })
    database(steps)
    const response = await handler(request(name))
    expect(await response.json()).toEqual({ ...expected, periodType: "monthly" })
    expect(service).toHaveBeenCalledTimes(1)
  })
})

const currentLeadPage = Array.from({ length: 1000 }, (_, i) => lead(`current-${i}`))
const previousLeadPage = Array.from({ length: 1000 }, (_, i) => lead(`previous-${i}`))

it.each([
  { stage: "later current leads page", steps: [step("leads", rows(currentLeadPage)), step("leads", failed)] },
  { stage: "later current sales chunk", steps: [step("leads", rows(currentLeadPage)), step("leads", rows()),
    step("sales", rows([sale("current-0")])), step("sales", failed)] },
  { stage: "later previous leads page", steps: [step("leads", rows([lead("current")])), step("sales", rows()),
    step("leads", rows(previousLeadPage)), step("leads", failed)] },
  { stage: "later previous sales chunk", steps: [step("leads", rows([lead("current")])), step("sales", rows()),
    step("leads", rows(previousLeadPage)), step("leads", rows()), step("sales", rows([sale("previous-0")])), step("sales", failed)] },
])("rejects client conversion partial data after $stage fails", async ({ steps }) => {
  const db = database(steps)
  await expectFailure(await clientConversion(request("client-conversion")), "Unable to load client conversion report")
  expect(db.queries).toHaveLength(steps.length)
})