/** @jest-environment node */

import { NextRequest } from "next/server"
import { GET } from "@/app/api/traffic/attribution/route"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { readThroughAnalyticsResponseCache } from "@/lib/redis/analytics-response-cache"
import { MAX_TRAFFIC_SESSIONS } from "@/lib/traffic/session-loader"
import { trafficDatabase, sessionId, START, END, SITE } from "./traffic-database-fixture"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock("@/lib/redis/analytics-response-cache", () => ({ readThroughAnalyticsResponseCache: jest.fn(({ load }) => load()) }))
jest.mock("@/lib/redis/control-plane", () => ({
  checkRateLimit: jest.fn(async () => ({ allowed: true })),
  hashRedisKeyPart: jest.fn(async (value: string) => value), rateLimitError: jest.fn(),
}))

const service = createServiceClient as jest.Mock
const userClient = createClient as jest.Mock
const cache = readThroughAnalyticsResponseCache as jest.Mock

function request(query: Record<string, string> = {}, authenticated = true) {
  const params = new URLSearchParams({ siteId: SITE, startDate: START.toISOString(), endDate: END.toISOString(), ...query })
  return new NextRequest(`http://localhost/api/traffic/attribution?${params}`, {
    headers: authenticated ? { cookie: "test-auth=value" } : {},
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.ANALYTICS_MAX_RANGE_DAYS
  userClient.mockResolvedValue({
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: "trusted-user" } }, error: null })) },
    rpc: jest.fn(async () => ({ data: "owner", error: null })),
  })
  service.mockResolvedValue(trafficDatabase().client)
})

it.each<Record<string, string>>([
  { siteId: "" }, { startDate: "" }, { endDate: "" }, { startDate: "invalid" },
  { startDate: "2026-10-01", endDate: "2026-09-01" },
  { startDate: "2020-01-01", endDate: "2026-09-01" },
])("validates malformed scope/date input before authorization or service work: %j", async query => {
  expect((await GET(request(query))).status).toBe(400)
  expect(service).not.toHaveBeenCalled()
  expect(userClient).not.toHaveBeenCalled()
  expect(cache).not.toHaveBeenCalled()
})

it("returns 401 without auth even if a query-string userId is supplied", async () => {
  expect((await GET(request({ userId: "forged" }, false))).status).toBe(401)
  expect(service).not.toHaveBeenCalled()
  expect(cache).not.toHaveBeenCalled()
})

it("returns 401 for an invalid session", async () => {
  userClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } })
  expect((await GET(request())).status).toBe(401)
  expect(service).not.toHaveBeenCalled()
  expect(cache).not.toHaveBeenCalled()
})

it("returns 403 for another tenant before even checking cache", async () => {
  const rpc = jest.fn(async () => ({ data: null, error: null }))
  userClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "member" } } }) }, rpc })
  expect((await GET(request({ siteId: "another-site" }))).status).toBe(403)
  expect(rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: "another-site" })
  expect(service).not.toHaveBeenCalled()
  expect(cache).not.toHaveBeenCalled()
})

it("rejects non-all segment filtering with 422 before service work", async () => {
  expect((await GET(request({ segmentId: "segment-a" }))).status).toBe(422)
  expect(service).not.toHaveBeenCalled()
  expect(cache).not.toHaveBeenCalled()
})

it("returns the public attribution DTO and safe current membership with complete pagination", async () => {
  const rows = Array.from({ length: 1103 }, (_, i) => ({
    id: sessionId(i + 1), utm_campaign: i % 2 ? "recorded" : null,
    landing_url: "https://shop.test/?utm_campaign=url&utm_source=partner",
    lead: { site_id: SITE, segment: { id: "a", name: "Lead segment", site_id: SITE } },
    visitor: { segment: { id: "b", name: "Visitor segment", site_id: SITE } },
  }))
  const db = trafficDatabase(rows, { cap: 367 })
  service.mockResolvedValue(db.client)
  const response = await GET(request({ segmentId: "all" }))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    segments: [{ name: "Lead segment", value: 1103 }],
    campaigns: [{ name: "url", value: 552 }, { name: "recorded", value: 551 }],
    coverage: { totalSessions: 1103, attributedSessions: 1103, unattributedSessions: 0, segmentedSessions: 1103, campaignSessions: 1103 },
    model: "session_entry", segmentMembership: "current",
  })
  expect(service).toHaveBeenCalledWith(true)
  expect(db.queries).toHaveLength(5)
  expect(cache).toHaveBeenCalledWith(expect.objectContaining({ namespace: "traffic:attribution:v1", siteId: SITE }))
})

it("does not expose cross-tenant lead/segment names even if nested response is unfiltered", async () => {
  const db = trafficDatabase([
    { id: sessionId(1), lead: { site_id: "other", segment: { id: "a", name: "PRIVATE", site_id: SITE } } },
    { id: sessionId(2), lead: { site_id: SITE, segment: { id: "b", name: "PRIVATE", site_id: "other" } } },
    { id: sessionId(3), visitor: { segment: { id: "c", name: "PRIVATE", site_id: "other" } } },
  ])
  service.mockResolvedValue(db.client)
  const body = await (await GET(request())).json()
  expect(body.segments).toEqual([{ name: "Unassigned segment", value: 3 }])
  expect(body.coverage.segmentedSessions).toBe(0)
  expect(JSON.stringify(body)).not.toContain("PRIVATE")
})

it("returns explicit actionable overflow instead of a 50k partial success", async () => {
  const rows = Array.from({ length: MAX_TRAFFIC_SESSIONS + 1 }, (_, i) => ({ id: sessionId(i + 1) }))
  service.mockResolvedValue(trafficDatabase(rows).client)
  const response = await GET(request())
  expect(response.status).toBe(422)
  expect(await response.json()).toEqual({
    error: "This report exceeds 50,000 sessions. Select a shorter date range.",
    code: "TRAFFIC_SESSION_LIMIT_EXCEEDED", maxSessions: 50_000,
  })
})

it("sanitizes later-page query errors", async () => {
  service.mockResolvedValue(trafficDatabase([{ id: sessionId(1) }, { id: sessionId(2) }], { cap: 1, errorAt: 1 }).client)
  const response = await GET(request())
  expect(response.status).toBe(500)
  expect(await response.json()).toEqual({ error: "Unable to load attribution report" })
})