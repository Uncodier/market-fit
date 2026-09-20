/** @jest-environment node */

import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { requireSiteAccess } from "@/lib/auth/api-site-access"

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

jest.mock("@/lib/auth/api-site-access", () => ({
  requireSiteAccess: jest.fn(),
}))

const SITE_ID = "00000000-0000-4000-8000-000000000001"

function request(query: string) {
  return {
    url: `https://example.test/api/performance/tokens?${query}`,
  } as Request
}

describe("analytics API access", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.ANALYTICS_MAX_RANGE_DAYS
  })

  it("rejects missing date parameters before authorization", async () => {
    const result = await requireAnalyticsAccess(
      request(`siteId=${SITE_ID}`)
    )

    expect(result.error?.status).toBe(400)
    expect(requireSiteAccess).not.toHaveBeenCalled()
  })

  it("rejects invalid and reversed ranges", async () => {
    const invalid = await requireAnalyticsAccess(
      request(`siteId=${SITE_ID}&startDate=nope&endDate=2026-01-01`)
    )
    const reversed = await requireAnalyticsAccess(
      request(
        `siteId=${SITE_ID}&startDate=2026-02-01&endDate=2026-01-01`
      )
    )

    expect(invalid.error?.status).toBe(400)
    expect(reversed.error?.status).toBe(400)
    expect(requireSiteAccess).not.toHaveBeenCalled()
  })

  it("rejects ranges longer than the configured maximum", async () => {
    process.env.ANALYTICS_MAX_RANGE_DAYS = "30"

    const result = await requireAnalyticsAccess(
      request(
        `siteId=${SITE_ID}&startDate=2026-01-01&endDate=2026-02-01`
      )
    )

    expect(result.error?.status).toBe(400)
    expect(requireSiteAccess).not.toHaveBeenCalled()
  })

  it("authorizes the requested site for a valid range", async () => {
    ;(requireSiteAccess as jest.Mock).mockResolvedValue({
      userId: "user-1",
      role: "owner",
    })

    const result = await requireAnalyticsAccess(
      request(
        `siteId=${SITE_ID}&startDate=2026-01-01&endDate=2026-01-31`
      )
    )

    expect(result.error).toBeUndefined()
    expect(requireSiteAccess).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.any(String) }),
      SITE_ID
    )
  })
})
