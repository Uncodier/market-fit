/** @jest-environment node */

import { NextRequest } from "next/server"
import { GET as performance } from "@/app/api/dashboard/performance/route"
import { GET as overview } from "@/app/api/dashboard/overview/route"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { createClient } from "@/lib/supabase/server"
import { acquireLock, getCachedJson, releaseLock, setCachedJson } from "@/lib/redis/control-plane"
import { reportMetricKeys, type ReportBatchKind } from "@/lib/dashboard/report-groups"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/redis/upstash-rest", () => ({ isRedisConfigured: () => true }))
jest.mock("@/lib/redis/control-plane", () => ({
  acquireLock: jest.fn(), getCachedJson: jest.fn(), releaseLock: jest.fn(), setCachedJson: jest.fn(),
  hashRedisKeyPart: jest.fn(async (value: string) => value),
  checkRateLimit: jest.fn(async () => ({ allowed: true })),
}))
jest.mock("@/app/api/performance/leads-contacted/route", () => ({ GET: jest.fn() }))
jest.mock("@/app/api/performance/leads-in-conversation/route", () => ({ GET: jest.fn() }))
jest.mock("@/app/api/performance/meetings/route", () => ({ GET: jest.fn() }))
jest.mock("@/app/api/performance/sales/route", () => ({ GET: jest.fn() }))
jest.mock("@/app/api/performance/tasks/route", () => ({ GET: jest.fn() }))
jest.mock("@/app/api/performance/conversations/route", () => ({ GET: jest.fn() }))
jest.mock("@/app/api/performance/contents-approved/route", () => ({ GET: jest.fn() }))
jest.mock("@/app/api/performance/requirements-completed/route", () => ({ GET: jest.fn() }))
jest.mock("@/app/api/performance/tokens/route", () => ({ GET: jest.fn() }))
jest.mock("@/app/api/performance/video-minutes/route", () => ({ GET: jest.fn() }))
jest.mock("@/app/api/performance/images-generated/route", () => ({ GET: jest.fn() }))
jest.mock("@/app/api/performance/metrics-overview/route", () => ({ GET: jest.fn() }))
jest.mock("@/app/api/revenue/route", () => ({ GET: jest.fn() }))
jest.mock("@/app/api/ltv/route", () => ({ GET: jest.fn() }))
jest.mock("@/app/api/cac/route", () => ({ GET: jest.fn() }))
jest.mock("@/app/api/cpl/route", () => ({ GET: jest.fn() }))
jest.mock("@/app/api/roi/route", () => ({ GET: jest.fn() }))
jest.mock("@/app/api/active-users/route", () => ({ GET: jest.fn() }))
jest.mock("@/app/api/active-segments/route", () => ({ GET: jest.fn() }))
jest.mock("@/app/api/active-campaigns/route", () => ({ GET: jest.fn() }))

const routes = { performance, overview }
const getUser = jest.fn()
const rpc = jest.fn()
const handler = (kind: ReportBatchKind, key: string): jest.Mock =>
  jest.requireMock(`@/app/api/${kind === "performance" ? "performance/" : ""}${key}/route`).GET

function request(kind: ReportBatchKind, extra = "", authenticated = true) {
  return new NextRequest(`https://example.test/api/dashboard/${kind}?siteId=site-a&startDate=2026-01-01&endDate=2026-01-31&segmentId=segment-a${extra}`, {
    headers: authenticated ? { cookie: "session=test" } : {},
  })
}

function expectNoMetrics() {
  for (const kind of ["performance", "overview"] as const) {
    for (const key of reportMetricKeys(kind)!) expect(handler(kind, key)).not.toHaveBeenCalled()
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.ANALYTICS_MAX_RANGE_DAYS
  delete process.env.REDIS_REQUIRED
  getUser.mockResolvedValue({ data: { user: { id: "trusted-user", email: null } }, error: null })
  rpc.mockResolvedValue({ data: "owner", error: null })
  ;(createClient as jest.Mock).mockResolvedValue({ auth: { getUser }, rpc })
  ;(getCachedJson as jest.Mock).mockResolvedValue(null)
  ;(acquireLock as jest.Mock).mockResolvedValue(true)
  for (const kind of ["performance", "overview"] as const) {
    for (const key of reportMetricKeys(kind)!) {
      handler(kind, key).mockImplementation(async (child: NextRequest) => {
        const access = await requireAnalyticsAccess(child)
        if (access.error) return access.error
        return Response.json({ actual: 7, metric: key })
      })
    }
  }
})

describe.each(["performance", "overview"] as const)("%s batch boundaries", kind => {
  it("retains the legacy full-batch response when no group is supplied", async () => {
    const response = await routes[kind](request(kind))
    expect(response.status).toBe(200)
    expect(Object.keys(await response.json()).sort()).toEqual([...reportMetricKeys(kind)!].sort())
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(getUser).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: "site-a" })
    expect(setCachedJson).toHaveBeenCalledTimes(2)
  })

  it("denies unauthenticated requests before cache reads or metrics", async () => {
    const response = await routes[kind](request(kind, "&userId=forged-user", false))
    expect(response.status).toBe(401)
    expect(getCachedJson).not.toHaveBeenCalled()
    expectNoMetrics()
  })

  it("denies foreign-tenant access even if the batch is cached", async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    ;(getCachedJson as jest.Mock).mockResolvedValue({ cached: true })
    const response = await routes[kind](request(kind))
    expect(response.status).toBe(403)
    expect(getCachedJson).not.toHaveBeenCalled()
    expectNoMetrics()
  })

  it("rejects an invalid date range before doing work", async () => {
    const req = request(kind)
    req.nextUrl.searchParams.set("startDate", "invalid")
    const response = await routes[kind](new NextRequest(req.nextUrl))
    expect(response.status).toBe(400)
    expect(getCachedJson).not.toHaveBeenCalled()
    expectNoMetrics()
  })

  it.each(["", "unknown", "OUTCOMES", "__proto__", "toString", "outcomes&group=outcomes"])(
    "rejects invalid/ambiguous group '%s' before cache reads", async group => {
      const response = await routes[kind](request(kind, `&group=${group}`))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: "Invalid report group" })
      expect(getCachedJson).not.toHaveBeenCalled()
      expectNoMetrics()
    }
  )
})

it.each([
  ["performance", "outcomes", ["leads-contacted", "leads-in-conversation", "meetings", "sales", "metrics-overview"]],
  ["performance", "operations", ["tasks", "conversations", "contents-approved", "requirements-completed", "metrics-overview"]],
  ["performance", "usage", ["tokens", "video-minutes", "images-generated"]],
  ["overview", "summary", ["revenue", "active-users", "active-segments", "active-campaigns"]],
  ["overview", "economics", ["ltv", "cac", "roi", "cpl"]],
] as const)("executes only %s/%s metrics", async (kind, group, expected) => {
  const response = await routes[kind](request(kind, `&group=${group}&userId=forged-user`))
  expect(response.status).toBe(200)
  expect(Object.keys(await response.json()).sort()).toEqual([...expected].sort())
  expect(createClient).toHaveBeenCalledTimes(1)
  for (const key of reportMetricKeys(kind)!) {
    const mock = handler(kind, key)
    expect(mock).toHaveBeenCalledTimes((expected as readonly string[]).includes(key) ? 1 : 0)
    if (mock.mock.calls.length) {
      const child = mock.mock.calls[0][0] as NextRequest
      expect(child.nextUrl.searchParams.get("group")).toBeNull()
      expect(child.nextUrl.searchParams.get("userId")).toBeNull()
      expect(child.nextUrl.searchParams.get("segmentId")).toBe("segment-a")
      expect(child.nextUrl.searchParams.get("startDate")).toBe("2026-01-01T00:00:00.000Z")
      expect(child.nextUrl.searchParams.get("endDate")).toBe("2026-01-31T23:59:59.999Z")
      expect(child.headers.get("cookie")).toBe("session=test")
      if (key === "revenue") expect(child.nextUrl.searchParams.get("includeCategories")).toBe("false")
    }
  }
})

it("authenticates overview activity but performs no cache or metric work", async () => {
  const response = await overview(request("overview", "&group=activity"))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({})
  expect(getUser).toHaveBeenCalledTimes(1)
  expect(getCachedJson).not.toHaveBeenCalled()
  expectNoMetrics()
})

it("isolates full and grouped cache entries", async () => {
  await performance(request("performance"))
  const fullKey = (getCachedJson as jest.Mock).mock.calls[0][0]
  ;(getCachedJson as jest.Mock).mockClear()
  await performance(request("performance", "&group=usage"))
  expect((getCachedJson as jest.Mock).mock.calls[0][0]).not.toBe(fullKey)
})

it("preserves legacy explicit timestamp ranges", async () => {
  const req = request("performance", "&group=usage")
  req.nextUrl.searchParams.set("startDate", "2026-01-01T08:12:00.000Z")
  req.nextUrl.searchParams.set("endDate", "2026-01-31T21:45:00.000Z")
  await performance(new NextRequest(req.nextUrl, { headers: req.headers }))
  const child = handler("performance", "tokens").mock.calls[0][0] as NextRequest
  expect(child.nextUrl.searchParams.get("startDate")).toBe("2026-01-01T08:12:00.000Z")
  expect(child.nextUrl.searchParams.get("endDate")).toBe("2026-01-31T21:45:00.000Z")
})

it("rejects impossible calendar dates instead of rolling them forward", async () => {
  const req = request("performance")
  req.nextUrl.searchParams.set("startDate", "2026-02-30")
  req.nextUrl.searchParams.set("endDate", "2026-03-15")
  const response = await performance(new NextRequest(req.nextUrl, { headers: req.headers }))
  expect(response.status).toBe(400)
  expectNoMetrics()
})

it("returns safe currency selection metadata without caching a 422", async () => {
  handler("overview", "revenue").mockResolvedValue(Response.json({
    error: "private details", availableCurrencies: ["EUR", "USD", "UNSPECIFIED"],
  }, { status: 422 }))
  const response = await overview(request("overview", "&group=summary"))
  expect(response.status).toBe(422)
  expect(await response.json()).toEqual({
    error: "Select a currency to view revenue metrics", availableCurrencies: ["EUR", "USD", "UNSPECIFIED"],
  })
  expect(setCachedJson).not.toHaveBeenCalled()
})

it("partitions server batch caches by authenticated identity, not query userId", async () => {
  await overview(request("overview", "&group=summary&userId=forged"))
  const firstKey = (setCachedJson as jest.Mock).mock.calls[0][0]
  getUser.mockResolvedValue({ data: { user: { id: "another-member", email: null } }, error: null })
  await overview(request("overview", "&group=summary&userId=forged"))
  const secondKey = (setCachedJson as jest.Mock).mock.calls[2][0]
  expect(firstKey).not.toEqual(secondKey)
  expect(firstKey).toContain("trusted-user")
  expect(secondKey).toContain("another-member")
  expect(firstKey).not.toContain("forged")
})

it("does not expose malformed currency metadata", async () => {
  handler("overview", "revenue").mockResolvedValue(Response.json({
    error: "private details", availableCurrencies: ["USD", "private details"],
  }, { status: 422 }))
  const response = await overview(request("overview", "&group=summary"))
  expect(response.status).toBe(502)
  expect(await response.json()).toEqual({ error: "Failed to load overview metrics" })
})

it.each([400, 401, 403, 429, 500, 503])("does not cache a child HTTP %i failure", async status => {
  handler("performance", "tokens").mockResolvedValue(Response.json(
    { error: "private provider details" }, { status, headers: { "Retry-After": "4" } }
  ))
  const response = await performance(request("performance", "&group=usage"))
  expect(response.status).toBe(status === 500 ? 502 : status)
  expect(await response.json()).toEqual({ error: "Failed to load performance metrics" })
  expect(response.headers.get("X-Cache")).toBeNull()
  expect(response.headers.get("Cache-Control")).toContain("no-store")
  expect(response.headers.get("Retry-After")).toBe([429, 503].includes(status) ? "4" : null)
  expect(setCachedJson).not.toHaveBeenCalled()
  expect(releaseLock).toHaveBeenCalledTimes(1)
})

it.each(["throw", "json", "error-payload"])("does not cache child %s failures", async failure => {
  const mock = handler("overview", "revenue")
  if (failure === "throw") mock.mockRejectedValue(new Error("private details"))
  else mock.mockResolvedValue(failure === "json" ? new Response("not json") : Response.json({ error: "private details" }))
  const response = await overview(request("overview", "&group=summary"))
  expect(response.status).toBe(502)
  expect(await response.json()).toEqual({ error: "Failed to load overview metrics" })
  expect(setCachedJson).not.toHaveBeenCalled()
})

it("returns retryable 503 without starting metrics when the cache is busy", async () => {
  process.env.REDIS_REQUIRED = "true"
  ;(acquireLock as jest.Mock).mockResolvedValue(false)
  const response = await performance(request("performance", "&group=outcomes"))
  expect(response.status).toBe(503)
  expect(response.headers.get("Retry-After")).toBe("2")
  expectNoMetrics()
})