/** @jest-environment node */

import { NextRequest, NextResponse } from "next/server"
import { createClient as sdkClient } from "@supabase/supabase-js"
import { GET } from "@/app/api/traffic/session-events-combined/route"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { createServiceClient } from "@/lib/supabase/server"
import { readThroughAnalyticsResponseCache } from "@/lib/redis/analytics-response-cache"

jest.mock("@/lib/auth/api-analytics-access", () => ({ requireAnalyticsAccess: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("@/lib/redis/analytics-response-cache", () => ({ readThroughAnalyticsResponseCache: jest.fn(({ load }) => load()) }))

const siteId = "00000000-0000-4000-8000-000000000001"
const queries: URL[] = []
let rows: Array<{ id: string; created_at: string; visitor_id: string | null; referrer: string | null }>
let databaseFailure = false
let failureOffset: number | undefined
let serverPageSize = 2
const request = (startDate = "2026-09-29", endDate = startDate, extra = {}) => new NextRequest(`https://example.test/api/traffic/session-events-combined?${new URLSearchParams({
  siteId, startDate, endDate, ...extra,
})}`, { headers: { cookie: "session=test" } })

beforeEach(() => {
  jest.clearAllMocks()
  queries.length = 0
  databaseFailure = false
  failureOffset = undefined
  serverPageSize = 2
  rows = [
    { id: "1", created_at: "2026-09-29T00:00:00Z", visitor_id: "visitor-a", referrer: null },
    { id: "2", created_at: "2026-09-29T14:00:00Z", visitor_id: "visitor-a", referrer: "https://search.test/" },
    { id: "3", created_at: "2026-09-29T23:59:59Z", visitor_id: "visitor-b", referrer: "https://site.test/" },
  ]
  jest.spyOn(console, "log").mockImplementation(() => {})
  jest.spyOn(console, "error").mockImplementation(() => {})
  jest.mocked(requireAnalyticsAccess).mockImplementation(async input => {
    const params = new URL(input.url).searchParams
    return { siteId, userId: "member", startDate: new Date(params.get("startDate")!), endDate: new Date(params.get("endDate")!) }
  })
  jest.mocked(createServiceClient).mockResolvedValue(sdkClient("https://database.test", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async input => {
      const url = new URL(String(input))
      queries.push(url)
      const table = url.pathname.split("/").at(-1)
      if (table === "sites") return Response.json({ url: "https://site.test" })
      if (table === "allowed_domains") return Response.json([])
      if (databaseFailure) return Response.json({ message: "private database detail" }, { status: 500 })
      const bounds = url.searchParams.getAll("created_at")
      const matching = rows.filter(row => bounds.every(bound => bound.startsWith("gte.")
        ? Date.parse(row.created_at) >= Date.parse(bound.slice(4)) : Date.parse(row.created_at) <= Date.parse(bound.slice(4))))
      const offset = Number(url.searchParams.get("offset") ?? 0)
      if (offset === failureOffset) return Response.json({ message: "private later page failure" }, { status: 500 })
      // A server cap lower than the requested page size must not truncate totals.
      return Response.json(matching.slice(offset, offset + serverPageSize))
    } },
  }))
})
afterEach(() => { jest.restoreAllMocks() })

it("includes the full selected end day, one-day bucket and UTC label", async () => {
  const response = await GET(request())
  expect(response.status).toBe(200)
  const result = await response.json()
  expect(result.totals).toEqual({ pageVisits: 3, uniqueVisitors: 2, referralVisits: 1 })
  expect(result.chartData).toEqual([{ date: "2026-09-29", label: "Sep 29", pageVisits: 3, uniqueVisitors: 2, referralVisits: 1 }])
  expect(result.referrersData.map((row: { referrer: string }) => row.referrer)).toEqual(["Direct", "search.test"])
  const eventQueries = queries.filter(url => url.pathname.endsWith("/session_events"))
  expect(eventQueries).toHaveLength(3)
  for (const url of eventQueries) {
    expect(url.searchParams.get("site_id")).toBe(`eq.${siteId}`)
    expect(url.searchParams.get("event_type")).toBe("eq.pageview")
    expect(url.searchParams.get("order")).toContain("created_at.asc")
    expect(url.searchParams.get("order")).toContain("id.asc")
    expect(url.searchParams.getAll("created_at")).toEqual(["gte.2026-09-29T00:00:00.000Z", "lte.2026-09-29T23:59:59.999Z"])
  }
})

it("keeps explicit timestamp bounds and supplies all touched UTC days", async () => {
  const response = await GET(request("2026-09-28T23:00:00Z", "2026-09-29T15:00:00Z"))
  const result = await response.json()
  expect(result.chartData.map((row: { date: string }) => row.date)).toEqual(["2026-09-28", "2026-09-29"])
  expect(result.totals.pageVisits).toBe(2)
})

it("returns a real empty day rather than no chart buckets", async () => {
  rows = []
  const result = await (await GET(request())).json()
  expect(result.chartData).toHaveLength(1)
  expect(result.chartData[0].pageVisits).toBe(0)
})

it.each([401, 403, 429])("preserves access failure %s before cache or service reads", async status => {
  jest.mocked(requireAnalyticsAccess).mockResolvedValue({ error: NextResponse.json({ error: "Denied" }, { status }) })
  expect((await GET(request())).status).toBe(status)
  expect(createServiceClient).not.toHaveBeenCalled()
  expect(readThroughAnalyticsResponseCache).not.toHaveBeenCalled()
})

it("preserves a database failure, not a partial successful total", async () => {
  databaseFailure = true
  const response = await GET(request())
  expect(response.status).toBe(500)
  expect(await response.text()).not.toContain("private database detail")
})

it.each(["0", "-1", "1000", "garbage"])("rejects invalid referrer limit %s", async referrersLimit => {
  expect((await GET(request("2026-09-29", "2026-09-29", { referrersLimit }))).status).toBe(400)
  expect(createServiceClient).not.toHaveBeenCalled()
})

it("does not return partial metrics after a later page fails", async () => {
  failureOffset = 2
  const response = await GET(request())
  expect(response.status).toBe(500)
  expect(await response.text()).not.toContain("private later page failure")
})

it("fails explicitly at the record ceiling instead of truncating or looping indefinitely", async () => {
  serverPageSize = 1000
  rows = Array.from({ length: 50_001 }, (_, index) => ({ ...rows[0], id: String(index) }))
  const response = await GET(request())
  expect(response.status).toBe(422)
  expect(await response.json()).toEqual({ error: "Too many session events. Select a shorter date range." })
})