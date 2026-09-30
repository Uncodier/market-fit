/** @jest-environment node */

import { NextResponse } from "next/server"
import { GET } from "@/app/api/dashboard/date-limits/route"
import { requireSiteAccess } from "@/lib/auth/api-site-access"

jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))
const siteId = "00000000-0000-4000-8000-000000000001"
const request = (query = `siteId=${siteId}`) => new Request(`https://example.test/api/dashboard/date-limits?${query}`)
beforeEach(() => { jest.clearAllMocks(); delete process.env.ANALYTICS_MAX_RANGE_DAYS })
afterEach(() => { delete process.env.ANALYTICS_MAX_RANGE_DAYS })

it.each(["", "siteId=invalid", `siteId=${siteId}&siteId=${siteId}`])("validates query before authorization: %s", async query => {
  expect((await GET(request(query))).status).toBe(400)
  expect(requireSiteAccess).not.toHaveBeenCalled()
})

it.each([401, 403])("preserves authorization failure %s", async status => {
  jest.mocked(requireSiteAccess).mockResolvedValue({ error: NextResponse.json({ error: "Denied" }, { status }) })
  expect((await GET(request())).status).toBe(status)
})

it("keeps unexpected access failures as errors without exposing provider details", async () => {
  jest.mocked(requireSiteAccess).mockRejectedValue(new Error("Private provider failure"))
  const response = await GET(request())
  expect(response.status).toBe(500)
  expect(await response.json()).toEqual({ error: "Unable to load report date options. Please retry." })
})

it("returns the configured limits without loading or mutating report data", async () => {
  process.env.ANALYTICS_MAX_RANGE_DAYS = "31"
  jest.mocked(requireSiteAccess).mockResolvedValue({ userId: "member", role: "owner", userEmail: null, supabase: {} })
  const response = await GET(request())
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  expect(await response.json()).toMatchObject({ limits: { performance: { outcomes: 31 }, costs: { summary: 31, categories: 366 } } })
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), siteId)
})