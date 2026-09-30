/** @jest-environment node */

import { GET } from "@/app/api/sites/route"
import { createServiceSupabase, createUserSupabase } from "@/lib/auth/site-member-request"
import { listAccessibleSitesForUser } from "@/lib/sites/list-accessible-sites"

jest.mock("@/lib/auth/site-member-request", () => ({
  createServiceSupabase: jest.fn(),
  createUserSupabase: jest.fn(),
}))
jest.mock("@/lib/sites/list-accessible-sites", () => ({ listAccessibleSitesForUser: jest.fn() }))

describe("GET /api/sites detail archive filtering", () => {
  beforeEach(() => jest.clearAllMocks())

  function setup(archivedAt: string | null, siteIds = ["site-1"]) {
    jest.mocked(createUserSupabase).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
    } as any)
    jest.mocked(listAccessibleSitesForUser).mockResolvedValue({
      sites: siteIds.map((id) => ({ id })), error: null,
    })
    const detail = { id: "site-1", logo_url: "logo", tracking: {}, resource_urls: [] }
    let excludeArchived = false
    const detailQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockImplementation(function () {
        excludeArchived = true
        return detailQuery
      }),
      single: jest.fn(async () => ({
        data: excludeArchived && archivedAt ? null : detail,
        error: null,
      })),
    }
    const admin = { from: jest.fn((table: string) => {
      if (table === "sites") return detailQuery
      return {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [], error: null }),
      }
    }) }
    jest.mocked(createServiceSupabase).mockReturnValue(admin as any)
    return { admin, detailQuery, detail }
  }

  it.each([null, "2026-09-22T10:00:00Z"])("rechecks archive state on detail lookup (%s)", async (archivedAt) => {
    const { detailQuery, detail } = setup(archivedAt)
    const response = await GET(new Request("https://example.test/api/sites?detail=site-1"))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, detail: archivedAt ? null : detail })
    expect(detailQuery.eq).toHaveBeenCalledWith("id", "site-1")
    expect(detailQuery.is).toHaveBeenCalledWith("archived_at", null)
  })

  it("does not query details for a site outside the accessible list", async () => {
    const { admin } = setup(null, ["other-site"])
    const response = await GET(new Request("https://example.test/api/sites?detail=site-1"))
    expect(await response.json()).toMatchObject({ detail: null })
    expect(admin.from).not.toHaveBeenCalledWith("sites")
  })

  it("still requires authentication before using the service client", async () => {
    setup(null)
    jest.mocked(createUserSupabase).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    } as any)
    const response = await GET(new Request("https://example.test/api/sites?detail=site-1"))
    expect(response.status).toBe(401)
    expect(createServiceSupabase).not.toHaveBeenCalled()
  })
})