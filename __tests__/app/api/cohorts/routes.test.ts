/** @jest-environment node */
import { GET as customers } from "@/app/api/cohorts/route"
import { GET as leads } from "@/app/api/leads-cohorts/route"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { createClient } from "@/lib/supabase/server"
import { normalizedRequestCacheKey, readThroughJsonCache } from "@/lib/redis/json-cache"
import { cohortErrorResponse } from "@/app/api/cohorts/lib/cache"
import { CohortLimitError } from "@/app/api/cohorts/lib/types"
import { cohortTestClient } from "./cohort-test-client"

jest.mock("@/lib/auth/api-analytics-access", () => ({ requireAnalyticsAccess: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/redis/json-cache", () => ({ normalizedRequestCacheKey: jest.fn(), readThroughJsonCache: jest.fn() }))

const siteId = "00000000-0000-4000-8000-000000000001"
const segmentId = "00000000-0000-4000-8000-000000000002"
const auth = requireAnalyticsAccess as jest.Mock
const create = createClient as jest.Mock
const key = normalizedRequestCacheKey as jest.Mock
const cache = readThroughJsonCache as jest.Mock
const request = (extra: Record<string, string> = {}) => new Request(`http://localhost/api/cohorts?${new URLSearchParams({
  siteId, startDate: "2025-01-06", endDate: "2025-02-02", ...extra,
})}`, { headers: { cookie: "session=test" } })

describe.each([["customer", customers], ["lead", leads]] as const)("%s cohort route access and cache boundaries", (_, get) => {
  beforeEach(() => {
    jest.clearAllMocks()
    auth.mockResolvedValue({ siteId, userId: "verified-user", startDate: new Date("2025-01-06"), endDate: new Date("2025-02-02") })
    create.mockResolvedValue(cohortTestClient({}).client)
    key.mockImplementation(async (namespace: string, req: Request) => `${namespace}:${new URL(req.url).search}`)
    cache.mockImplementation(async ({ compute }) => ({ status: "computed", value: await compute() }))
  })

  it.each([401, 403, 429])("does not read/cache data after access denial (%i)", async status => {
    auth.mockResolvedValue({ error: Response.json({ error: "Denied" }, { status }) })
    expect((await get(request())).status).toBe(status)
    expect(create).not.toHaveBeenCalled()
    expect(cache).not.toHaveBeenCalled()
  })

  it.each<Record<string, string>>([
    { startDate: "bad" }, { startDate: "2025-02-30" }, { segmentId: "bad" },
    { siteId: "bad" }, { endDate: "2025-05-02" }, { endDate: "2024-12-31" },
    { startDate: "2025-01-06T24:00:00Z" }, { endDate: "2025-02-02T12:60:00Z" },
  ])("rejects malformed inputs before cache access: %j", async extra => {
    expect((await get(request(extra))).status).toBe(400)
    expect(cache).not.toHaveBeenCalled()
  })

  it("authorizes the normalized selected range and skips demo clients", async () => {
    const response = await get(request())
    expect(response.status).toBe(200)
    expect(create).toHaveBeenCalledWith(true)
    const authorized = auth.mock.calls[0][0] as Request
    expect(authorized.headers.get("cookie")).toBe("session=test")
    expect(new URL(authorized.url).searchParams.get("endDate")).toBe("2025-02-02T23:59:59.999Z")
    expect(response.headers.get("X-Cache")).toBe("COMPUTED")
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(await response.json()).toMatchObject({ metadata: {
      startDate: "2025-01-06T00:00:00.000Z", endDate: "2025-02-02T23:59:59.999Z",
      observationEnd: "2025-02-02T23:59:59.999Z", weekStartsOn: "Monday", observationPolicy: "complete-weeks-only",
    } })
    expect(auth.mock.invocationCallOrder[0]).toBeLessThan(cache.mock.invocationCallOrder[0])
  })

  it("isolates cached RLS results by verified user and revalidates every cache hit", async () => {
    cache.mockResolvedValue({ status: "hit", value: { sentinel: true } })
    const response = await get(request({ _cohortViewer: "forged", userId: "forged" }))
    expect(await response.json()).toEqual({ sentinel: true })
    const first = new URL((key.mock.calls[0][1] as Request).url)
    expect(first.searchParams.get("_cohortViewer")).toBe("verified-user")
    auth.mockResolvedValue({ siteId, userId: "other-verified-user" })
    await get(request({ _cohortViewer: "verified-user" }))
    expect(cache.mock.calls[0][0].key).not.toBe(cache.mock.calls[1][0].key)
    expect(key.mock.calls[0][0]).toContain("observed-v2")
    expect(auth).toHaveBeenCalledTimes(2)
  })

  it("rejects a segment from another site before cached data or anonymous sales can bypass it", async () => {
    const { client, calls } = cohortTestClient({ segments: [{ id: segmentId, site_id: "other-site" }] })
    create.mockResolvedValue(client)
    const response = await get(request({ segmentId }))
    expect(response.status).toBe(400)
    expect(cache).not.toHaveBeenCalled()
    expect(calls).toHaveLength(1)
    expect(calls[0].filters).toEqual(expect.arrayContaining([
      { op: "eq", column: "site_id", value: siteId }, { op: "eq", column: "id", value: segmentId },
    ]))
  })

  it("keeps refresh-busy retry behavior without serving a fabricated empty report", async () => {
    cache.mockResolvedValue({ status: "busy" })
    const response = await get(request())
    expect(response.status).toBe(503)
    expect(response.headers.get("Retry-After")).toBe("2")
  })

  it("surfaces database failures as uncached sanitized errors", async () => {
    create.mockResolvedValue(cohortTestClient({}, { errors: { sales: "XX000", leads: "XX000" } }).client)
    const response = await get(request())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "Failed to load cohort report" })
    expect(response.headers.get("X-Cache")).toBeNull()
  })
})

it("returns an explicit non-success cap error, not partial cohorts", async () => {
  const response = cohortErrorResponse(new CohortLimitError("Select a shorter period"))
  expect(response.status).toBe(422)
  expect(await response.json()).toEqual({ error: "Select a shorter period", code: "COHORT_ROW_LIMIT" })
})