/** @jest-environment node */

import { NextRequest, NextResponse } from "next/server"
import { GET } from "@/app/api/active-experiments/route"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { createServiceApiClient } from "@/lib/supabase/server-client"
import { createClient } from "@supabase/supabase-js"
import { findOrCreateKpi } from "@/app/api/active-experiments/kpi"

jest.mock("@/lib/auth/api-analytics-access", () => ({ requireAnalyticsAccess: jest.fn() }))
jest.mock("@/lib/supabase/server-client", () => ({ createServiceApiClient: jest.fn() }))
jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }))
jest.mock("@/app/api/active-experiments/kpi", () => ({
  ...jest.requireActual("@/app/api/active-experiments/kpi"), findOrCreateKpi: jest.fn(),
}))

const siteId = "11111111-1111-4111-8111-111111111111"
const request = (extra = "") => new NextRequest(`https://app.example.test/api/active-experiments?siteId=${siteId}${extra}`)

beforeEach(() => {
  jest.resetAllMocks()
})

describe("active experiment analytics authorization", () => {
  it.each([401, 403, 400])("returns %s before creating privileged clients", async status => {
    jest.mocked(requireAnalyticsAccess).mockResolvedValue({ error: NextResponse.json({ error: "Denied" }, { status }) })
    const response = await GET(request())
    expect(response.status).toBe(status)
    expect(createServiceApiClient).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it("validates the default date window when callers omit dates", async () => {
    jest.mocked(requireAnalyticsAccess).mockResolvedValue({ error: NextResponse.json({}, { status: 401 }) })
    await GET(request())
    const checked = jest.mocked(requireAnalyticsAccess).mock.calls[0][0]
    const url = new URL(checked.url)
    const start = Date.parse(url.searchParams.get("startDate")!)
    const end = Date.parse(url.searchParams.get("endDate")!)
    expect(Number.isFinite(start)).toBe(true)
    expect(end - start).toBeGreaterThanOrEqual(30 * 86400000)
    expect(url.searchParams.get("siteId")).toBe(siteId)
  })

  it("uses the authenticated identity rather than the requested KPI author", async () => {
    jest.mocked(requireAnalyticsAccess).mockResolvedValue({
      siteId, userId: "trusted-user", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-29"),
    })
    const query = {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), lt: jest.fn().mockReturnThis(),
      then: (resolve: (value: { data: { id: string; status: string }[]; error: null }) => unknown) =>
        Promise.resolve({ data: [{ id: "experiment-1", status: "active" }], error: null }).then(resolve),
    }
    jest.mocked(createServiceApiClient).mockReturnValue({ from: jest.fn(() => query) })
    jest.mocked(findOrCreateKpi).mockResolvedValue({ kpi: null, created: false })
    const response = await GET(request("&userId=forged-user"))
    expect(response.status).toBe(200)
    expect(createServiceApiClient).toHaveBeenCalledWith(siteId)
    expect(findOrCreateKpi).toHaveBeenCalled()
    for (const call of jest.mocked(findOrCreateKpi).mock.calls) {
      expect(call[2].userId).toBe("trusted-user")
      expect(call[2].siteId).toBe(siteId)
    }
  })
})