/** @jest-environment node */
import { GET, PATCH } from "@/app/api/site-members/[siteId]/location-restrictions/route"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { createServiceSupabase } from "@/lib/auth/site-member-request"
import { rejectPrematureLocationRestrictions } from "@/lib/permissions/location-access-request"

jest.mock("server-only", () => ({}))
jest.mock("next/server", () => ({ NextResponse: { json: (body: unknown, init?: { status?: number; headers?: unknown }) => ({
  status: init?.status ?? 200, headers: init?.headers, json: async () => body,
}) } }))
jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))
jest.mock("@/lib/auth/site-member-request", () => ({ createServiceSupabase: jest.fn() }))

const siteId = "00000000-0000-4000-8000-000000000001"
const memberId = "00000000-0000-4000-8000-000000000002"
const locationId = "00000000-0000-4000-8000-000000000003"
const context = { params: Promise.resolve({ siteId }) }
const request = (body: unknown = {}) => new Request(`http://localhost/api/site-members/${siteId}/location-restrictions`, {
  method: "PATCH", body: JSON.stringify(body),
})
const rpc = jest.fn()
const from = jest.fn()
const configuration = {
  site_id: siteId,
  members: [{ id: memberId, role: "collaborator", is_location_exempt: false, restricted_location_ids: [locationId] }],
  locations: [{ id: locationId, name: "Branch A", is_active: false }],
}

describe("location restriction API readiness boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(requireSiteAccess).mockResolvedValue({ role: "owner", userId: memberId, userEmail: null,
      supabase: { rpc, from } as unknown as Awaited<ReturnType<typeof requireSiteAccess>>["supabase"] } as Awaited<ReturnType<typeof requireSiteAccess>>)
    rpc.mockResolvedValue({ data: configuration, error: null })
    jest.mocked(createServiceSupabase).mockReturnValue({ from } as unknown as ReturnType<typeof createServiceSupabase>)
  })

  it("returns only manager-authorized same-site configuration with editing closed", async () => {
    const response = await GET(request(), context)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ site_id: siteId, editing_enabled: false,
      members: [{ id: memberId, restricted_location_ids: [locationId] }],
      locations: [{ id: locationId, name: "Branch A", is_active: false }] })
    expect(requireSiteAccess).toHaveBeenCalledWith(expect.anything(), siteId, { requireManager: true })
    expect(rpc).toHaveBeenCalledWith("read_site_location_restrictions", { p_site_id: siteId })
    expect(createServiceSupabase).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
    expect(response.headers).toEqual({ "Cache-Control": "private, no-store" })
  })

  it.each([401, 403])("denies access before any privileged configuration read (%i)", async status => {
    jest.mocked(requireSiteAccess).mockResolvedValue({ error: { status } } as Awaited<ReturnType<typeof requireSiteAccess>>)
    expect((await GET(request(), context)).status).toBe(status)
    expect((await PATCH(request({ memberId, restricted_location_ids: [] }), context)).status).toBe(status)
    expect(createServiceSupabase).not.toHaveBeenCalled()
  })

  it("rejects malformed tenant IDs before authentication or database calls", async () => {
    const invalid = { params: Promise.resolve({ siteId: "demo-site" }) }
    expect((await GET(request(), invalid)).status).toBe(400)
    expect((await PATCH(request(), invalid)).status).toBe(400)
    expect(requireSiteAccess).not.toHaveBeenCalled()
  })

  it.each(["PGRST202", "42883"])("distinguishes missing database setup (%s) without fabricating empty restrictions", async code => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "Missing function" } })
    const response = await GET(request(), context)
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: "LOCATION_ACCESS_SCHEMA_UNAVAILABLE" })
    expect(createServiceSupabase).not.toHaveBeenCalled()
  })

  it("rechecks the manager role in the live scope before privileged reads", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } })
    expect((await GET(request(), context)).status).toBe(403)
    expect(createServiceSupabase).not.toHaveBeenCalled()
  })

  it("rejects orphaned/cross-site or failed restriction reads", async () => {
    rpc.mockResolvedValue({ data: { ...configuration, locations: [] }, error: null })
    expect((await GET(request(), context)).status).toBe(503)
    rpc.mockResolvedValue({ data: { ...configuration, site_id: memberId }, error: null })
    expect((await GET(request(), context)).status).toBe(503)
    rpc.mockResolvedValue({ data: null, error: { message: "Unavailable" } })
    expect((await GET(request(), context)).status).toBe(503)
  })

  it("accepts nullable legacy location activity and retains unknown state", async () => {
    rpc.mockResolvedValue({ data: { ...configuration, locations: [{ ...configuration.locations[0], is_active: null }] }, error: null })
    const response = await GET(request(), context)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ locations: [{ is_active: null }] })
  })

  it.each(["members", "locations"] as const)("rejects duplicate %s rather than presenting ambiguous configuration", async collection => {
    const data = { ...configuration, [collection]: [...configuration[collection], ...configuration[collection]] }
    rpc.mockResolvedValue({ data, error: null })
    expect((await GET(request(), context)).status).toBe(503)
  })

  it.each([{ ids: [] }, { ids: [locationId] }])("refuses premature editing including clearing %j", async ({ ids }) => {
    const response = await PATCH(request({ memberId, restricted_location_ids: ids }), context)
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: "LOCATION_ACCESS_NOT_READY" })
    expect(createServiceSupabase).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([{}, null, { memberId }, { memberId, restricted_location_ids: null },
    { memberId, restricted_location_ids: [locationId, locationId] }, { memberId, restricted_location_ids: [], userId: memberId },
  ])("rejects invalid or omitted replacement instead of clearing: %j", async body => {
    expect((await PATCH(request(body), context)).status).toBe(400)
  })

  it("rejects oversized bodies even without a declared content length", async () => {
    expect((await PATCH(request({ data: "x".repeat(65537) }), context)).status).toBe(413)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("rejects malformed JSON instead of reporting an internal failure", async () => {
    const malformed = new Request("http://localhost", { method: "PATCH", body: "{" })
    expect((await PATCH(malformed, context)).status).toBe(400)
  })

  it("preserves legacy omission but rejects restriction requests in legacy member endpoints", () => {
    expect(rejectPrematureLocationRestrictions({ name: "Changed" })).toBeNull()
    expect(rejectPrematureLocationRestrictions({ restricted_location_ids: [] })?.status).toBe(409)
    expect(rejectPrematureLocationRestrictions({ restricted_location_ids: ["foreign"] })?.status).toBe(400)
  })
})