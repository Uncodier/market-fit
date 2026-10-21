/** @jest-environment node */
import { GET, POST } from "@/app/api/location-scope/route"
import { requireSiteAccess } from "@/lib/auth/api-site-access"

jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))
jest.mock("next/server", () => ({ NextResponse: { json: (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { ...init, headers: init?.headers }) } }))

const siteId = "11111111-1111-4111-8111-111111111111"
const id = "22222222-2222-4222-8222-222222222222"
const locationId = "33333333-3333-4333-8333-333333333333"
const saved = { table: "deals", id, site_id: siteId, location_id: locationId }
const request = (body?: unknown, query = `siteId=${siteId}&table=deals`) => new Request(`http://localhost/api/location-scope?${query}`, {
  ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
})
const assignment = { table: "deals", id, locationId }
const rpc = jest.fn()
const from = jest.fn()
function query(rows: unknown[]) {
  return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(), range: jest.fn().mockResolvedValue({ data: rows, error: null }) }
}

describe("manager-only canonical location assignment API", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.mocked(requireSiteAccess).mockResolvedValue({ role: "owner", userId: id, userEmail: null,
      supabase: { from, rpc } } as unknown as Awaited<ReturnType<typeof requireSiteAccess>>)
    rpc.mockResolvedValue({ data: saved, error: null })
  })

  it.each([401, 403])("rejects unauthorized reads and assignments (%s) before database work", async status => {
    jest.mocked(requireSiteAccess).mockResolvedValue({ error: new Response(null, { status }) } as Awaited<ReturnType<typeof requireSiteAccess>>)
    expect((await GET(request())).status).toBe(status)
    expect((await POST(request(assignment))).status).toBe(status)
    expect(from).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled()
  })

  it("validates tenant, closed root registry, record and branch IDs", async () => {
    expect((await GET(request(undefined, "siteId=demo-x&table=deals"))).status).toBe(400)
    expect((await GET(request(undefined, `siteId=${siteId}&table=profiles`))).status).toBe(400)
    expect((await GET(request(undefined, `siteId=${siteId}&table=deals&page=-1`))).status).toBe(400)
    for (const body of [{ ...assignment, id: "invalid" }, { ...assignment, locationId: null }, { ...assignment, table: "sales" }, { ...assignment, siteId }]) {
      expect((await POST(request(body))).status).toBe(400)
    }
    expect(from).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled()
  })

  it("reads same-site unresolved roots with bounded stable paging and minimal labels", async () => {
    const roots = query([{ id, name: "Deal A", location_id: null, created_at: "2026-10-20", secret: "never-return" }])
    const locations = query([{ id: locationId, name: "Branch A", is_active: true }])
    from.mockImplementation(table => table === "locations" ? locations : roots)
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(requireSiteAccess).toHaveBeenCalledWith(expect.anything(), siteId, { requireManager: true })
    expect(roots.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(roots.is).toHaveBeenCalledWith("location_id", null)
    expect(roots.range).toHaveBeenCalledWith(0, 50)
    expect(locations.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    const body = await response.json()
    expect(body.records).toEqual([{ id, label: "Deal A · 2026-10-20 · 22222222", location_id: null }])
    expect(body.hasMore).toBe(false)
    expect(JSON.stringify(body)).not.toContain("never-return")
  })

  it("uses reservation operating_location_id, never its physical resource", async () => {
    const roots = query([{ id, start_time: "2026-10-20", operating_location_id: locationId }])
    const locations = query([])
    from.mockImplementation(table => table === "locations" ? locations : roots)
    const body = await (await GET(request(undefined, `siteId=${siteId}&table=reservations&id=${id}`))).json()
    expect(roots.select).toHaveBeenCalledWith("id, operating_location_id, start_time, created_at")
    expect(roots.eq).toHaveBeenCalledWith("id", id)
    expect(roots.is).not.toHaveBeenCalled()
    expect(body.records[0].location_id).toBe(locationId)
  })

  it("does not turn database errors or unavailable new columns into empty success", async () => {
    const roots = query([])
    roots.range.mockResolvedValue({ data: null, error: { code: "42703" } } as never)
    from.mockReturnValue(roots)
    expect((await GET(request())).status).toBe(503)
  })

  it("passes only verified assignment inputs to user-scoped manager RPC", async () => {
    const response = await POST(request(assignment))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(saved)
    expect(rpc).toHaveBeenCalledWith("assign_location_scope", { p_table: "deals", p_id: id, p_site_id: siteId, p_location_id: locationId })
    expect(from).not.toHaveBeenCalled()
  })

  it.each(["22023", "23503", "23514", "40001", "40P01", "55P03"])("rejects cross-site/stale/conflicting or concurrent assignment without replay (%s)", async code => {
    rpc.mockResolvedValue({ error: { code, message: "private database detail" } })
    const response = await POST(request(assignment))
    expect(response.status).toBe(409)
    expect(JSON.stringify(await response.json())).not.toContain("private database detail")
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it.each([null, { ...saved, site_id: id }, { ...saved, location_id: id }, { ...saved, table: "tasks" }])("does not claim success for unverified RPC response %j", async data => {
    rpc.mockResolvedValue({ data, error: null })
    expect((await POST(request(assignment))).status).toBe(503)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it("maps RPC reauthorization denial and bounds request bodies", async () => {
    rpc.mockResolvedValue({ error: { code: "42501" } })
    expect((await POST(request(assignment))).status).toBe(403)
    const large = request({ text: "x".repeat(5000) })
    expect((await POST(large)).status).toBe(413)
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})