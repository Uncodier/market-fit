/** @jest-environment node */


import { createClient } from "@supabase/supabase-js"
import {
  listAccessibleSitesForUser, mergeAccessibleSites, SITE_LIST_COLUMNS,
  type SitesAdminClient, type SitesQuery as Query,
} from "@/lib/sites/list-accessible-sites"

type Row = Record<string, unknown>
type Response = Awaited<Query>
type Stage = "owned" | "memberships" | "extra"
type Call = {
  table: string; stage: Stage; from: number; to: number
  signal?: AbortSignal; order?: string; ids?: string[]
}
type Options = {
  cap?: number
  calls?: Call[]
  respond?: (call: Call, response: Response) => Response | Promise<Response>
}

function fakeAdmin(
  tables: Record<string, Row[]>, trackSelects: string[] = [], options: Options = {}
): SitesAdminClient {
  return {
    from(table) {
      if (table === "site_ownership") throw new Error("Redundant ownership query")
      const filters: Array<(row: Row) => boolean> = []
      const call: Call = { table, stage: table === "sites" ? "owned" : "memberships", from: 0, to: Infinity }
      const execute = async (): Promise<Response> => {
        options.calls?.push({ ...call })
        const rows = (tables[table] || []).filter((row) => filters.every((filter) => filter(row)))
          .sort((a, b) => String(a[call.order!]).localeCompare(String(b[call.order!])))
        const response: Response = {
          data: rows.slice(call.from, Math.min(call.to + 1, call.from + (options.cap ?? Infinity))),
          error: null, count: rows.length,
        }
        return options.respond ? options.respond(call, response) : response
      }
      const builder: Query = {
        eq(column, value) {
          filters.push((row) => row[column] === value)
          return builder
        },
        in(column, values) {
          call.stage = "extra"
          call.ids = values
          filters.push((row) => values.includes(row[column] as string))
          return builder
        },
        is(column, value) {
          filters.push((row) => row[column] === value)
          return builder
        },
        order(column, { ascending }) {
          expect(ascending).toBe(true)
          call.order = column
          return builder
        },
        range(from, to) { call.from = from; call.to = to; return builder },
        abortSignal(signal) { call.signal = signal; return builder },
        then(resolve, reject) { return execute().then(resolve, reject) },
      }
      return {
        select(cols, settings) {
          expect(settings).toEqual({ count: "exact" })
          if (table === "sites") trackSelects.push(cols)
          return builder
        },
      }
    },
  }
}

function fixtures(size = 3) {
  const sites = Array.from({ length: size }, (_, index) => ({
    id: `site-${String(index).padStart(5, "0")}`, user_id: "other", archived_at: null,
  }))
  return {
    sites: [{ id: "owned", user_id: "user-1", archived_at: null }, ...sites],
    site_members: sites.map((site, index) => ({
      id: `membership-${String(index).padStart(5, "0")}`, site_id: site.id,
      user_id: "user-1", status: "active", license_suspended: false,
    })),
  }
}

describe("mergeAccessibleSites", () => {
  it("dedupes by id and keeps the last copy", () => {
    expect(
      mergeAccessibleSites(
        [{ id: "a", name: "Owned" }],
        [{ id: "a", name: "Member" }, { id: "b", name: "Extra" }]
      )
    ).toEqual([
      { id: "a", name: "Member" },
      { id: "b", name: "Extra" },
    ])
  })
})

describe("listAccessibleSitesForUser", () => {
  it("excludes suspended shared access even when an ownership record remains", async () => {
    const result = await listAccessibleSitesForUser(fakeAdmin({
      sites: [{ id: "shared", user_id: "other", archived_at: null }],
      site_members: [{ site_id: "shared", user_id: "user-1", status: "active", license_suspended: true }],
      site_ownership: [{ site_id: "shared", user_id: "user-1" }],
    }), "user-1")
    expect(result.sites).toEqual([])
  })

  it("returns owned sites plus licensed active memberships", async () => {
    const admin = fakeAdmin({
      sites: [
        { id: "owned", name: "Owned", user_id: "user-1", archived_at: null },
        { id: "member", name: "Member", user_id: "other", archived_at: null },
        { id: "co-owned", name: "Co-owned", user_id: "other", archived_at: null },
        { id: "other", name: "Other", user_id: "other", archived_at: null },
      ],
      site_members: [
        { site_id: "member", user_id: "user-1", status: "active", license_suspended: false },
        { site_id: "co-owned", user_id: "user-1", status: "active", license_suspended: false },
        { site_id: "pending", user_id: "user-1", status: "pending" },
      ],
      site_ownership: [{ site_id: "co-owned", user_id: "user-1" }],
    })

    const { sites, error } = await listAccessibleSitesForUser(admin, "user-1")
    expect(error).toBeNull()
    expect(sites.map((site) => site.id).sort()).toEqual(["co-owned", "member", "owned"])
  })

  it("uses slim columns to avoid fetching heavy fields like base64 logos", async () => {
    const trackSelects: string[] = []
    const admin = fakeAdmin({
      sites: [{ id: "owned", user_id: "user-1", archived_at: null }],
      site_members: [],
      site_ownership: []
    }, trackSelects)
    
    await listAccessibleSitesForUser(admin, "user-1")
    
    expect(trackSelects.length).toBeGreaterThan(0)
    for (const cols of trackSelects) {
      expect(cols).toBe(SITE_LIST_COLUMNS)
      expect(cols).not.toContain("logo_url")
      expect(cols).not.toContain("*")
    }
  })

  it("excludes archived owned, member, and co-owned sites without changing relationships", async () => {
    const archived_at = "2026-09-22T10:00:00Z"
    const tables = {
      sites: [
        { id: "active", user_id: "user-1", archived_at: null },
        { id: "owned", user_id: "user-1", archived_at },
        { id: "member", user_id: "other", archived_at },
        { id: "co-owned", user_id: "other", archived_at },
      ],
      site_members: [
        { site_id: "owned", user_id: "user-1", status: "active", license_suspended: false },
        { site_id: "member", user_id: "user-1", status: "active", license_suspended: false },
      ],
      site_ownership: [{ site_id: "co-owned", user_id: "user-1" }],
    }
    const before = JSON.stringify(tables)

    const result = await listAccessibleSitesForUser(fakeAdmin(tables), "user-1")

    expect(result).toEqual({ sites: [tables.sites[0]], error: null })
    expect(JSON.stringify(tables)).toBe(before)
  })

  it("does not construct queries for an already aborted signal", async () => {
    const controller = new AbortController()
    controller.abort()
    const from = jest.fn()
    expect(await listAccessibleSitesForUser({ from }, "user-1", controller.signal))
      .toEqual({ sites: [], error: "Site list request aborted" })
    expect(from).not.toHaveBeenCalled()
  })

  it("stops before scheduling another page after cancellation", async () => {
    const controller = new AbortController()
    const calls: Call[] = []
    const admin = fakeAdmin(fixtures(), [], { calls, cap: 1, respond(call, response) {
      if (call.stage === "memberships" && call.from === 1) controller.abort()
      return response
    } })
    expect(await listAccessibleSitesForUser(admin, "user-1", controller.signal))
      .toEqual({ sites: [], error: "Site list request aborted" })
    expect(calls.filter(call => call.stage === "memberships").map(call => call.from)).toEqual([0, 1])
    expect(calls.some(call => call.stage === "extra")).toBe(false)
  })

  it("passes the signal through real Supabase builders to in-flight fetches", async () => {
    const controller = new AbortController()
    const signals: Array<AbortSignal | null | undefined> = []
    let started!: () => void
    const ready = new Promise<void>(resolve => { started = resolve })
    const fetcher: typeof fetch = async (_input, init) => {
      signals.push(init?.signal)
      if (signals.length === 2) started()
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Fetch aborted", "AbortError")), { once: true })
      })
    }
    const admin = createClient("https://example.test", "test-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: fetcher },
    })
    const pending = listAccessibleSitesForUser(admin, "user-1", controller.signal)
    await ready
    expect(signals).toEqual([controller.signal, controller.signal])
    controller.abort()
    await expect(pending).resolves.toEqual({ sites: [], error: "Site list request aborted" })
  })


  it("paginates past a server cap and forwards the signal to every page", async () => {
    const tables = fixtures(5)
    tables.sites.push({ id: "owned-2", user_id: "user-1", archived_at: null })
    const calls: Call[] = []
    const signal = new AbortController().signal
    const result = await listAccessibleSitesForUser(fakeAdmin(tables, [], { cap: 1, calls }), "user-1", signal)
    expect(result.error).toBeNull()
    expect(result.sites.map(site => site.id).sort()).toEqual(tables.sites.map(site => site.id).sort())
    expect(calls.filter(call => call.stage === "owned").map(call => call.from)).toEqual([0, 1])
    for (const stage of ["memberships", "extra"]) {
      expect(calls.filter(call => call.stage === stage).map(call => call.from)).toEqual([0, 1, 2, 3, 4])
    }
    expect(calls.every(call => call.signal === signal && call.order === "id" && call.to - call.from === 499)).toBe(true)
  })

  it("reads beyond the normal page size and batches membership IDs", async () => {
    const tables = fixtures(501)
    const calls: Call[] = []
    const result = await listAccessibleSitesForUser(fakeAdmin(tables, [], { calls }), "user-1")
    expect(result).toEqual({ sites: tables.sites, error: null })
    expect(calls.filter(call => call.stage === "memberships").map(call => call.from)).toEqual([0, 500])
    expect(calls.filter(call => call.stage === "extra").map(call => call.ids?.length)).toEqual([100, 100, 100, 100, 100, 1])
    expect(calls.every(call => call.signal === undefined)).toBe(true)
  })

  it("discards earlier ID batches if a later batch fails", async () => {
    const admin = fakeAdmin(fixtures(101), [], { respond(call, response) {
      return call.stage === "extra" && call.ids?.includes("site-00100")
        ? { ...response, error: { message: "Batch failed" } } : response
    } })
    expect(await listAccessibleSitesForUser(admin, "user-1")).toEqual({ sites: [], error: "Batch failed" })
  })

  it("runs at most three ID batches concurrently and preserves deterministic output", async () => {
    const tables = fixtures(601)
    const calls: Call[] = []
    let running = 0
    let peak = 0
    const release: Array<() => void> = []
    const admin = fakeAdmin(tables, [], { calls, async respond(call, response) {
      if (call.stage !== "extra") return response
      peak = Math.max(peak, ++running)
      await new Promise<void>(resolve => { release.push(() => { running--; resolve() }) })
      return response
    } })
    const pending = listAccessibleSitesForUser(admin, "user-1")
    const flush = () => new Promise(resolve => setImmediate(resolve))
    await flush()
    expect(release).toHaveLength(3)
    expect(calls.filter(call => call.stage === "extra")).toHaveLength(3)
    // Completing two requests must not start a new wave or reorder the results.
    release[2]()
    release[1]()
    await flush()
    expect(release).toHaveLength(3)
    release[0]()
    await flush()
    expect(release).toHaveLength(6)
    release.slice(3, 6).reverse().forEach(finish => finish())
    await flush()
    expect(release).toHaveLength(7)
    release[6]()
    expect(await pending).toEqual({ sites: tables.sites, error: null })
    expect(peak).toBe(3)
  })

  it("does not schedule later ID waves or publish a partial list after a batch error", async () => {
    const calls: Call[] = []
    const result = await listAccessibleSitesForUser(fakeAdmin(fixtures(601), [], {
      calls, respond(call, response) {
        return call.stage === "extra" && call.ids?.includes("site-00100")
          ? { ...response, error: { message: "Parallel batch failed" } } : response
      },
    }), "user-1")
    expect(result).toEqual({ sites: [], error: "Parallel batch failed" })
    expect(calls.filter(call => call.stage === "extra")).toHaveLength(3)
  })

  it.each<Stage>(["owned", "memberships", "extra"])("fails explicitly at the %s pagination bound", async stage => {
    const tables = fixtures(21)
    if (stage === "owned") tables.sites.forEach(site => { site.user_id = "user-1" })
    const calls: Call[] = []
    const admin = fakeAdmin(tables, [], { calls, respond(call, response) {
      if (call.stage === stage) return { ...response, data: response.data!.slice(0, 1) }
      return response
    } })
    expect(await listAccessibleSitesForUser(admin, "user-1")).toEqual({
      sites: [], error: "Site list pagination limit exceeded",
    })
    expect(calls.filter(call => call.stage === stage)).toHaveLength(20)
  })

  it("allows a complete result on the last permitted page", async () => {
    const tables = fixtures(20)
    expect(await listAccessibleSitesForUser(fakeAdmin(tables, [], { cap: 1 }), "user-1"))
      .toEqual({ sites: tables.sites, error: null })
  })

  it.each(["missing-count", "changed-count", "missing-data", "empty-page", "over-count"])(
    "does not report success with %s", async mode => {
      const admin = fakeAdmin(fixtures(), [], { cap: 1, respond(call, response) {
        if (call.stage !== "memberships") return response
        if (mode === "missing-count") return { ...response, count: null }
        if (mode === "missing-data") return { ...response, data: null }
        if (mode === "over-count") return { ...response, count: 0 }
        if (call.from > 0 && mode === "changed-count") return { ...response, count: 4 }
        if (call.from > 0 && mode === "empty-page") return { ...response, data: [] }
        return response
      } })
      const result = await listAccessibleSitesForUser(admin, "user-1")
      expect(result.sites).toEqual([])
      expect(result.error).toBeTruthy()
    }
  )

  it("returns a successful empty list only after both reads succeed", async () => {
    const calls: Call[] = []
    expect(await listAccessibleSitesForUser(fakeAdmin({}, [], { calls }), "user-1"))
      .toEqual({ sites: [], error: null })
    expect(calls.map(call => call.stage)).toEqual(["owned", "memberships"])
  })


  it("matches the previous ownership union for every access combination", async () => {
    for (const owned of [false, true]) for (const membership of [false, true]) {
      for (const ownership of [false, true]) for (const archived of [false, true]) {
        for (const status of ["active", "pending"]) for (const suspended of [false, true, null]) {
          const site = { id: "site", user_id: owned ? "user-1" : "other", archived_at: archived ? "date" : null }
          const ownedIds = new Set(owned && !archived ? [site.id] : [])
          const memberIds = new Set(membership && status === "active" && suspended === false ? [site.id] : [])
          const ownershipIds = ownership ? [site.id] : []
          const previousIds = new Set([...ownedIds, ...memberIds, ...ownershipIds.filter(
            id => ownedIds.has(id) || memberIds.has(id)
          )])
          const admin = fakeAdmin({
            sites: [site],
            site_members: membership ? [{ site_id: site.id, user_id: "user-1", status, license_suspended: suspended }] : [],
            site_ownership: ownershipIds.map(site_id => ({ site_id, user_id: "user-1" })),
          })
          expect(await listAccessibleSitesForUser(admin, "user-1")).toEqual({
            sites: !archived && previousIds.has(site.id) ? [site] : [], error: null,
          })
        }
      }
    }
  })

  it("deduplicates memberships, ignores other users and skips redundant site reads", async () => {
    const tables = fixtures(1)
    tables.site_members.push({ ...tables.site_members[0], id: "duplicate" }, {
      ...tables.site_members[0], id: "owned-member", site_id: "owned",
    }, { ...tables.site_members[0], id: "foreign", site_id: "foreign", user_id: "other" })
    const calls: Call[] = []
    const result = await listAccessibleSitesForUser(fakeAdmin(tables, [], { calls }), "user-1")
    expect(result).toEqual({ sites: tables.sites, error: null })
    expect(calls.filter(call => call.stage === "extra").map(call => call.ids)).toEqual([["site-00000"]])
  })

  describe.each<Stage>(["owned", "memberships", "extra"])("%s failures", stage => {
    it.each(["returned", "rejected", "empty-message"])("fails the entire list on a %s error", async mode => {
      const admin = fakeAdmin(fixtures(), [], { respond(call, response) {
        if (call.stage !== stage) return response
        if (mode === "rejected") throw new Error("Query unavailable")
        return { ...response, error: { message: mode === "empty-message" ? "" : "Query unavailable" } }
      } })
      expect(await listAccessibleSitesForUser(admin, "user-1")).toEqual({
        sites: [], error: mode === "empty-message" ? "Query failed" : "Query unavailable",
      })
    })

    it("discards earlier pages when a later page fails", async () => {
      const tables = fixtures()
      if (stage === "owned") tables.sites.forEach(site => { site.user_id = "user-1" })
      const admin = fakeAdmin(tables, [], { cap: 1, respond(call, response) {
        return call.stage === stage && call.from > 0
          ? { ...response, error: { message: "Later page failed" } } : response
      } })
      expect(await listAccessibleSitesForUser(admin, "user-1")).toEqual({ sites: [], error: "Later page failed" })
    })

    it("rejects cancellation even when the query resolves successfully", async () => {
      const controller = new AbortController()
      const calls: Call[] = []
      const admin = fakeAdmin(fixtures(), [], { calls, respond(call, response) {
        if (call.stage === stage) controller.abort()
        return response
      } })
      expect(await listAccessibleSitesForUser(admin, "user-1", controller.signal)).toEqual({
        sites: [], error: "Site list request aborted",
      })
      expect(calls.every(call => call.signal === controller.signal)).toBe(true)
      if (stage !== "extra") expect(calls.some(call => call.stage === "extra")).toBe(false)
    })
  })

  it("converts synchronous builder errors and non-Error rejections to list failures", async () => {
    const admin: SitesAdminClient = { from() { throw new Error("Builder failed") } }
    expect(await listAccessibleSitesForUser(admin, "user-1")).toEqual({ sites: [], error: "Builder failed" })
    expect(await listAccessibleSitesForUser(fakeAdmin({}, [], { respond() {
      return Promise.reject(null)
    } }), "user-1")).toEqual({ sites: [], error: "Query failed" })
  })

})
