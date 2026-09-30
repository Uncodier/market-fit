/** @jest-environment node */
import { GET } from "@/app/api/settings/icp-mining-lists/route"
import { createClient, createServiceClient } from "@/lib/supabase/server"

// Exercise the real requireSiteAccess; only database/session boundaries are mocked.
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
const siteId = "abcdef12-3456-7890-abcd-ef1234567890"
const otherId = "abcdef12-3456-7890-abcd-ef1234567891"
const listId = "abcdef12-3456-7890-abcd-ef1234567892"
const request = (query = `site_id=${siteId}`, credentials = true) => new Request(`https://example.test/api/settings/icp-mining-lists?${query}`, {
  headers: credentials ? { cookie: "session=fixture" } : {},
})

describe("authenticated pending mining lists API", () => {
  let getUser: jest.Mock
  let rpc: jest.Mock
  let query: any
  let from: jest.Mock
  let rows: any[]
  beforeEach(() => {
    jest.clearAllMocks()
    getUser = jest.fn().mockResolvedValue({ data: { user: { id: "user", email: "user@example.test" } }, error: null })
    rpc = jest.fn().mockResolvedValue({ data: "member", error: null })
    jest.mocked(createClient).mockResolvedValue({ auth: { getUser }, rpc } as never)
    rows = [{ id: listId, site_id: siteId, name: "Unsegmented list", status: "pending", total_targets: 100,
      processed_targets: 10, progress_percent: "10", role_query_segments: [], private_data: "not exposed" }]
    query = {}
    for (const method of ["select", "eq", "in", "order", "limit", "gt"]) query[method] = jest.fn(() => query)
    query.then = (resolve: any, reject: any) => {
      const site = query.eq.mock.calls.find(([column]: string[]) => column === "site_id")?.[1]
      const statuses = query.in.mock.calls.find(([column]: string[]) => column === "status")?.[1] || []
      const after = query.gt.mock.calls[0]?.[1]
      const data = rows.filter(row => row.site_id === site && statuses.includes(row.status) && (!after || row.id > after))
      return Promise.resolve({ data, error: null }).then(resolve, reject)
    }
    from = jest.fn(() => query)
    jest.mocked(createServiceClient).mockResolvedValue({ from } as never)
  })

  it("rejects missing credentials without constructing either database client", async () => {
    expect((await GET(request(undefined, false))).status).toBe(401)
    expect(createClient).not.toHaveBeenCalled()
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  it("rejects a signed-out session before elevated reads", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await GET(request())).status).toBe(401)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  it.each([null, "rpc-error"])("rejects nonmembers or failed authorization %s before elevated reads", async role => {
    rpc.mockResolvedValue(role ? { data: null, error: { message: "private error" } } : { data: null, error: null })
    expect((await GET(request())).status).toBe(403)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  it.each(["", "site_id=invalid", `site_id=${siteId}&after=invalid`, `site_id=${siteId}&site_id=${otherId}`,
    `site_id=${siteId}&after=${listId}&after=${otherId}`])("rejects malformed input: %s", async params => {
    expect((await GET(request(params))).status).toBe(400)
    expect(createClient).not.toHaveBeenCalled()
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  it("lists site-owned pending and running records even without a segment; exposes only minimal fields", async () => {
    rows.push({ ...rows[0], id: otherId, site_id: otherId }, { ...rows[0], status: "completed" }, { ...rows[0], status: "failed" })
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(await response.json()).toEqual({ lists: [{ id: listId, name: "Unsegmented list", status: "pending",
      total_targets: 100, processed_targets: 10, progress_percent: "10" }], next_cursor: listId })
    expect(createClient).toHaveBeenCalledWith(true)
    expect(rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: siteId })
    expect(createServiceClient).toHaveBeenCalledWith(true)
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(createServiceClient).mock.invocationCallOrder[0])
    expect(from).toHaveBeenCalledWith("icp_mining")
    expect(query.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(query.in).toHaveBeenCalledWith("status", ["pending", "running"])
    expect(query.limit).toHaveBeenCalledWith(200)
  })
  it("uses an exclusive ID cursor scoped to the authorized site and ends on an empty page", async () => {
    const response = await GET(request(`site_id=${siteId}&after=${listId.toUpperCase()}`))
    expect(query.gt).toHaveBeenCalledWith("id", listId)
    expect(await response.json()).toEqual({ lists: [], next_cursor: null })
  })
  it("never exposes database failures or partial results", async () => {
    query.then = (resolve: any) => Promise.resolve({ data: null, error: { message: "private details" } }).then(resolve)
    const response = await GET(request())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "Unable to load mining lists" })
  })
});