import { fetchAccessibleSitesClient } from "@/lib/sites/fetch-accessible-sites"

describe("fetchAccessibleSitesClient", () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it("uses the demo RPC and ignores empty PostgREST objects by snapshotting them", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [{ id: "demo-1" }], error: null })
    const result = await fetchAccessibleSitesClient({ _isDemo: true, rpc })
    expect(rpc).toHaveBeenCalledWith("get_my_accessible_sites")
    expect(result).toEqual({
      sites: [{ id: "demo-1" }],
      error: null,
      aborted: false,
      unauthorized: false,
    })
  })

  it("loads real sites from /api/sites instead of the RPC", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, sites: [{ id: "site-1" }] }),
    }) as unknown as typeof fetch

    const rpc = jest.fn()
    const result = await fetchAccessibleSitesClient({ rpc })
    expect(rpc).not.toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith("/api/sites", { credentials: "include" })
    expect(result.sites).toEqual([{ id: "site-1" }])
    expect(result.error).toBeNull()
    expect(result.unauthorized).toBe(false)
  })

  it("treats 401 from /api/sites as unauthorized instead of a load failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false, error: "Not authenticated" }),
    }) as unknown as typeof fetch

    const result = await fetchAccessibleSitesClient({})
    expect(result.sites).toEqual([])
    expect(result.unauthorized).toBe(true)
    expect(result.aborted).toBe(false)
    expect(result.error?.message).toBe("Not authenticated")
  })

  it("passes detail parameter when provided and extracts it from payload", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, sites: [{ id: "site-1" }], detail: { id: "site-1", logo_url: "a" } }),
    }) as unknown as typeof fetch

    const rpc = jest.fn()
    const result = await fetchAccessibleSitesClient({ rpc }, "site-1")
    expect(global.fetch).toHaveBeenCalledWith("/api/sites?detail=site-1", { credentials: "include" })
    expect(result.detail).toEqual({ id: "site-1", logo_url: "a" })
  })

  it("returns an aborted flag instead of a blank {} error", async () => {
    const abortError = { name: "AbortError", message: "The user aborted a request." }
    const rpc = jest.fn().mockResolvedValue({ data: null, error: abortError })
    const result = await fetchAccessibleSitesClient({ _isDemo: true, rpc })
    expect(result.aborted).toBe(true)
    expect(result.error?.message).toBe("The user aborted a request.")
  })
})
