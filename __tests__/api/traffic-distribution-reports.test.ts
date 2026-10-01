/** @jest-environment node */

import { NextRequest, NextResponse } from "next/server"
import { GET as pages } from "@/app/api/traffic/pages/route"
import { GET as referrals } from "@/app/api/traffic/referrals/route"
import { GET as regions } from "@/app/api/traffic/regions/route"
import { GET as devices } from "@/app/api/traffic/devices/route"
import { GET as browsers } from "@/app/api/traffic/browsers/route"
import { createServiceClient } from "@/lib/supabase/server"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { readThroughAnalyticsResponseCache } from "@/lib/redis/analytics-response-cache"
import { trafficDatabase, sessionId } from "./traffic-database-fixture"
import type { TrafficSession } from "@/lib/traffic/types"

jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("@/lib/auth/api-analytics-access", () => ({ requireAnalyticsAccess: jest.fn() }))
jest.mock("@/lib/redis/analytics-response-cache", () => ({ readThroughAnalyticsResponseCache: jest.fn(({ load }) => load()) }))

const startDate = new Date("2026-09-01T00:00:00Z")
const endDate = new Date("2026-09-29T23:59:59.999Z")
const access = requireAnalyticsAccess as jest.Mock
const service = createServiceClient as jest.Mock
const cache = readThroughAnalyticsResponseCache as jest.Mock
const routes = { pages, referrals, regions, devices, browsers }

function request(segmentId = "all") {
  return new NextRequest(`http://localhost/api/traffic/pages?siteId=site-a&segmentId=${segmentId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
}

function database(data: Partial<TrafficSession>[] = [], error: unknown = null) {
  const db = trafficDatabase(data.map((row, i) => ({ ...row, id: sessionId(i + 1) })), { errorAt: error ? 0 : undefined })
  service.mockResolvedValue(db.client)
  return db
}

beforeEach(() => {
  jest.clearAllMocks()
  access.mockResolvedValue({ siteId: "authorized-site", startDate, endDate, userId: "trusted-user" })
  database()
})

describe.each(Object.entries(routes))("traffic %s report", (name, handler) => {
  it("accepts session auth without userId, uses authorized scope, and versions its cache", async () => {
    const db = database()
    const response = await handler(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [] })
    expect(db.queries[0].eq).toHaveBeenCalledWith("site_id", "authorized-site")
    expect(db.queries[0].lte).toHaveBeenCalledWith("created_at", endDate.toISOString())
    expect(service).toHaveBeenCalledWith(true)
    expect(cache).toHaveBeenCalledWith(expect.objectContaining({ namespace: `traffic:${name}:v3`, lockTtlMs: 30_000 }))
  })

  it.each([400, 401, 403])("stops before cache or elevated queries when access fails (%s)", async status => {
    access.mockResolvedValue({ error: NextResponse.json({ error: "Denied" }, { status }) })
    expect((await handler(request())).status).toBe(status)
    expect(service).not.toHaveBeenCalled()
    expect(cache).not.toHaveBeenCalled()
  })

  it("does not pretend unsupported segment attribution is all-site data", async () => {
    const response = await handler(request("segment-a"))
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: expect.stringContaining("Select all segments") })
    expect(service).not.toHaveBeenCalled()
  })

  it("returns a failure rather than a successful empty report on database errors", async () => {
    database([], { message: "private detail" })
    const response = await handler(request())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: `Unable to load ${name} report` })
  })

  it("counts past 1000 and preserves the complete denominator with a residual bucket", async () => {
    const rows = Array.from({ length: 1234 }, (_, index) => ({
      id: sessionId(index + 1), utm_source: `source-${index % 20}`,
      landing_url: `https://example.test/page-${index % 20}`,
      device: { type: `device-${index % 20}` }, browser: { name: `browser-${index % 20}` },
      location: { country: `country-${index % 20}` },
    }))
    const db = trafficDatabase(rows, { cap: 317 })
    service.mockResolvedValue(db.client)
    const response = await handler(request())
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.reduce((sum: number, row: { value: number }) => sum + row.value, 0)).toBe(1234)
    expect(body.data).toHaveLength(11)
    expect(body.data[10].name).toBe("Other")
    expect(db.queries).toHaveLength(5)
  })

  it("does not return a partial success when a later page fails", async () => {
    const db = trafficDatabase([{ id: sessionId(1) }, { id: sessionId(2) }], { cap: 1, errorAt: 1 })
    service.mockResolvedValue(db.client)
    const response = await handler(request())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: `Unable to load ${name} report` })
  })
})

it("keeps unknown and internal cross-navigation in the referral denominator", async () => {
  database([{ referrer: "https://google.com/search" }, { referrer: null }, { referrer: "https://app.makinari.com/dashboard" }])
  const response = await referrals(request())
  const body = await response.json()
  expect(body.data).toEqual([
    { name: "Direct / unknown", value: 1 }, { name: "Google", value: 1 }, { name: "Internal navigation", value: 1 },
  ])
})