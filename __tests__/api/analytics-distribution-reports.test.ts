/** @jest-environment node */

import { NextResponse } from "next/server"
import { GET as revenueBySegment } from "@/app/api/revenue-by-segment/route"
import { GET as revenueByCampaign } from "@/app/api/revenue-by-campaign/route"
import { GET as clientsBySegment } from "@/app/api/clients-by-segment/route"
import { GET as clientsByCampaign } from "@/app/api/clients-by-campaign/route"
import { createServiceClient } from "@/lib/supabase/server"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { normalizedRequestCacheKey } from "@/lib/redis/json-cache"

jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("@/lib/auth/api-analytics-access", () => ({ requireAnalyticsAccess: jest.fn() }))
jest.mock("@/lib/redis/json-cache", () => ({
  normalizedRequestCacheKey: jest.fn(async namespace => namespace),
  readThroughJsonCache: jest.fn(async ({ compute }) => ({ status: "miss", value: await compute() })),
}))

const service = createServiceClient as jest.Mock
const access = requireAnalyticsAccess as jest.Mock
const routes = { "revenue-by-segment": revenueBySegment, "revenue-by-campaign": revenueByCampaign, "clients-by-segment": clientsBySegment, "clients-by-campaign": clientsByCampaign }

function request(segmentId = "all") {
  return new Request(`http://localhost/api/distribution?siteId=site-a&segmentId=${segmentId}&startDate=2026-09-01T00:00:00Z&endDate=2026-09-29T23:59:59.999Z`)
}

function database(rows: Record<string, object[]> = {}, failedTable?: string) {
  const queries: { table: string; calls: Record<string, jest.Mock> }[] = []
  service.mockResolvedValue({ from: jest.fn((table: string) => {
    const calls: Record<string, jest.Mock> = {}
    for (const method of ["select", "eq", "gte", "lte", "not", "in", "order"]) calls[method] = jest.fn(() => calls)
    calls.then = jest.fn(resolve => {
      const filters = calls.eq.mock.calls
      const data = (rows[table] ?? []).filter(row => filters.every(([key, value]) => key === "site_id" || key === "status" || (row as Record<string, unknown>)[key] === value))
      return Promise.resolve({ data, error: table === failedTable ? { message: "private detail" } : null }).then(resolve)
    })
    queries.push({ table, calls })
    return calls
  }) })
  return queries
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers().setSystemTime(new Date("2026-09-29T12:00:00Z"))
  access.mockResolvedValue({ siteId: "site-a", userId: "trusted-user" })
  database()
})
afterEach(() => jest.useRealTimers())

describe.each(Object.entries(routes))("%s", (name, handler) => {
  it("queries through the full selected day rather than returning fake future-date empties", async () => {
    const queries = database()
    const response = await handler(request())
    expect(response.status).toBe(200)
    expect(service).toHaveBeenCalledTimes(1)
    expect(queries.find(query => query.table === "sales")?.calls.lte).toHaveBeenCalledWith("created_at", "2026-09-29T23:59:59.999Z")
    expect(normalizedRequestCacheKey).toHaveBeenCalledWith(`${name}:v2`, expect.any(Request))
  })

  it("filters sales (and client leads) directly within the selected site", async () => {
    const queries = database()
    expect((await handler(request("segment-a"))).status).toBe(200)
    for (const query of queries.filter(query => ["leads", "sales"].includes(query.table))) {
      expect(query.calls.eq).toHaveBeenCalledWith("site_id", "site-a")
      expect(query.calls.eq).toHaveBeenCalledWith("segment_id", "segment-a")
    }
  })

  it("rejects denied access before cache and service queries", async () => {
    access.mockResolvedValue({ error: NextResponse.json({ error: "Denied" }, { status: 403 }) })
    expect((await handler(request())).status).toBe(403)
    expect(service).not.toHaveBeenCalled()
    expect(normalizedRequestCacheKey).not.toHaveBeenCalled()
  })

  it("does not report partial or zero totals when sales fail", async () => {
    database({}, "sales")
    const response = await handler(request())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "Failed to fetch sales" })
  })
})

it("does not fall back to all leads when a campaign segment has no matches", async () => {
  database({ campaigns: [{ id: "campaign-a", title: "Campaign" }], leads: [{ id: "lead-a", campaign_id: "campaign-a", segment_id: "other-segment" }] })
  const body = await (await clientsByCampaign(request("empty-segment"))).json()
  expect(body.campaigns).toEqual([])
})

it("keeps segment revenue numeric and scoped", async () => {
  database({
    segments: [{ id: "segment-a", name: "Audience A" }],
    sales: [{ segment_id: "segment-a", amount: "3.5" }, { segment_id: "segment-a", amount: 1.5 }, { segment_id: "other", amount: 900 }],
  })
  const body = await (await revenueBySegment(request("segment-a"))).json()
  expect(body.segments).toEqual([{ name: "Audience A", value: 5, color: expect.any(String) }])
})