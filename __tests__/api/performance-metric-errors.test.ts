/** @jest-environment node */

import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { readThroughJsonCache } from "@/lib/redis/json-cache"

jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("@/lib/auth/api-analytics-access", () => ({
  requireAnalyticsAccess: jest.fn(async () => ({ siteId: "site-a", userId: "trusted-user" })),
}))
jest.mock("@/lib/redis/json-cache", () => ({
  normalizedRequestCacheKey: jest.fn(async () => "cache:key"),
  readThroughJsonCache: jest.fn(),
}))

const metrics = [
  ["leads-contacted", 2], ["leads-in-conversation", 2], ["meetings", 2], ["sales", 2],
  ["tasks", 2], ["conversations", 2], ["contents-approved", 2], ["requirements-completed", 2],
  ["tokens", 4], ["images-generated", 2], ["video-minutes", 2], ["metrics-overview", 12],
] as const
const cacheable = jest.fn()
const queries: Array<{ table: string; eq: jest.Mock }> = []
let failAt = -1

function request(metric: string, segment = "all") {
  return new NextRequest(`https://example.test/api/performance/${metric}?siteId=site-a&startDate=2026-01-01&endDate=2026-01-02&segmentId=${segment}`)
}
function get(metric: string): (req: NextRequest) => Promise<Response> {
  return jest.requireActual(`@/app/api/performance/${metric}/route`).GET
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, "error").mockImplementation(() => {})
  jest.spyOn(console, "log").mockImplementation(() => {})
  queries.length = 0
  failAt = -1
  ;(readThroughJsonCache as jest.Mock).mockImplementation(async ({ compute }) => {
    const value = await compute()
    cacheable(value)
    return { status: "computed", value }
  })
  ;(createServiceClient as jest.Mock).mockResolvedValue({
    from: (table: string) => {
      const index = queries.length
      const query: Record<string, any> = { table }
      for (const method of ["select", "eq", "or", "gte", "lte", "range", "order", "ilike", "maybeSingle"]) {
        query[method] = jest.fn(() => query)
      }
      query.then = (resolve: (value: unknown) => void) => resolve({
        data: [], count: 0,
        error: index === failAt ? { message: "private database details" } : null,
      })
      queries.push(query as { table: string; eq: jest.Mock })
      return query
    },
  })
})

afterEach(() => { jest.restoreAllMocks() })

it.each(metrics)("%s succeeds without a client userId for an empty valid period", async (metric, count) => {
  const response = await get(metric)(request(metric))
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ actual: 0, percentChange: 0 })
  expect(queries).toHaveLength(count)
  expect(cacheable).toHaveBeenCalledTimes(1)
})

it.each(metrics.flatMap(([metric, count]) => Array.from({ length: count }, (_, index) => [metric, index] as const)))(
  "%s query %i failure is not a cacheable zero/partial KPI", async (metric, index) => {
    failAt = index
    const response = await get(metric)(request(metric))
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toEqual(expect.any(String))
    expect(body.actual).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain("private database details")
    expect(cacheable).not.toHaveBeenCalled()
  }
)

it.each(metrics)("%s unexpected failure is not cached", async metric => {
  ;(createServiceClient as jest.Mock).mockRejectedValue(new Error("private details"))
  const response = await get(metric)(request(metric))
  expect(response.status).toBe(500)
  expect(await response.json()).toEqual({ error: expect.any(String) })
  expect(cacheable).not.toHaveBeenCalled()
})

it("applies the same segment to current and previous chart queries", async () => {
  const response = await get("metrics-overview")(request("metrics-overview", "segment-a"))
  expect(response.status).toBe(200)
  for (const query of queries) {
    expect(query.eq).toHaveBeenCalledWith(expect.stringMatching(/segment_id$/), "segment-a")
    expect(query.eq).toHaveBeenCalledWith("site_id", "site-a")
  }
})