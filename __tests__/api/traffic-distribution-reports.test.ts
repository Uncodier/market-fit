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

function database(data: unknown[] = [], error: unknown = null) {
  const query: Record<string, jest.Mock> = {}
  for (const method of ["select", "eq", "gte", "lte", "not"]) query[method] = jest.fn(() => query)
  query.then = jest.fn(resolve => Promise.resolve({ data, error }).then(resolve))
  service.mockResolvedValue({ from: jest.fn(() => query) })
  return query
}

beforeEach(() => {
  jest.clearAllMocks()
  access.mockResolvedValue({ siteId: "authorized-site", startDate, endDate, userId: "trusted-user" })
  database()
})

describe.each(Object.entries(routes))("traffic %s report", (name, handler) => {
  it("accepts session auth without userId, uses authorized scope, and versions its cache", async () => {
    const query = database()
    const response = await handler(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [] })
    expect(query.eq).toHaveBeenCalledWith("site_id", "authorized-site")
    expect(query.lte).toHaveBeenCalledWith("created_at", endDate.toISOString())
    expect(cache).toHaveBeenCalledWith(expect.objectContaining({ namespace: `traffic:${name}:v2` }))
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
})

it("keeps real referral totals and excludes internal cross-navigation", async () => {
  database([{ referrer: "https://google.com/search" }, { referrer: null }, { referrer: "https://app.makinari.com/dashboard" }])
  const response = await referrals(request())
  const body = await response.json()
  expect(body.data).toEqual([{ name: "Google", value: 1 }, { name: "Direct", value: 1 }])
})