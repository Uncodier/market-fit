/** @jest-environment node */
import { GET, PUT } from "@/app/api/procurement/policy/route"
import { GET as references } from "@/app/api/procurement/references/route"
import { createClient } from "@/lib/supabase/server"
import { defaultPolicyDocument } from "@/app/purchases/procurement/domain"
import { procurementRuleSchema } from "@/app/purchases/procurement/domain"
import { assignRuleVersions } from "@/app/api/procurement/policy/rule-versions"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
const siteId = "11111111-1111-4111-8111-111111111111"
const userId = "22222222-2222-4222-8222-222222222222"
const document = defaultPolicyDocument()
const row = { revision: 1, document, created_at: "2026-10-27T12:00:00Z", created_by: userId }
const request = (method = "GET", body: unknown = { expected_revision: 0, document }, extra: Record<string, string> = {}) =>
  new Request(`https://example.test/api/procurement/policy?site_id=${siteId}`, {
    method, headers: { cookie: "session=fixture", "content-type": "application/json", ...extra },
    ...(method === "PUT" ? { body: JSON.stringify(body) } : {}),
  })

describe("procurement configuration API", () => {
  let rpc: jest.Mock
  let from: jest.Mock
  let getUser: jest.Mock
  let result: { data: unknown; error: unknown }
  let saveResult: { data: unknown; error: unknown }
  let query: Record<string, jest.Mock>
  beforeEach(() => {
    jest.clearAllMocks()
    result = { data: null, error: null }
    saveResult = { data: [row], error: null }
    query = {}
    for (const method of ["select", "eq", "order", "limit", "in", "not", "ilike"]) {
      query[method] = jest.fn(() => query)
    }
    query.maybeSingle = jest.fn(async () => result)
    query.single = jest.fn(async () => result)
    query.then = jest.fn(resolve => Promise.resolve(result).then(resolve))
    from = jest.fn(() => query)
    rpc = jest.fn(async (name: string) => {
      if (name === "save_procurement_policy") return saveResult
      return { data: name === "current_user_site_role" ? "owner" : false, error: null }
    })
    getUser = jest.fn(async () => ({ data: { user: { id: userId } }, error: null }))
    jest.mocked(createClient).mockResolvedValue({ auth: { getUser }, rpc, from } as never)
  })

  it("returns an explicit unconfigured state only after a successful authorized read", async () => {
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ revision: 0, document: null })
    expect(query.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
  })
  it("reads a validated snapshot", async () => {
    result.data = row
    expect(await (await GET(request())).json()).toEqual(row)
  })
  it("rejects anonymous calls before constructing a client", async () => {
    expect((await GET(request("GET", undefined, { cookie: "" }))).status).toBe(401)
    expect(createClient).not.toHaveBeenCalled()
  })
  it.each(["collaborator", "viewer", null])("rejects unauthorized role %s", async role => {
    rpc.mockResolvedValue({ data: role, error: null })
    expect((await GET(request())).status).toBe(403)
    expect(from).not.toHaveBeenCalled()
  })
  it("rejects location restrictions and failed role lookup", async () => {
    rpc.mockImplementation(async (name: string) => ({ data: name === "current_user_site_role" ? "admin" : true, error: null }))
    expect((await GET(request())).status).toBe(403)
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } })
    expect((await GET(request())).status).toBe(503)
  })
  it("rejects malformed, duplicated and demo workspace input", async () => {
    for (const suffix of ["bad", `${siteId}&site_id=${siteId}`, "demo-test"]) {
      expect((await GET(new Request(`https://example.test/?site_id=${suffix}`))).status).toBe(400)
    }
    expect((await PUT(request("PUT", undefined, { cookie: "market_fit_demo_site_id=demo-test" }))).status).toBe(403)
    expect(from).not.toHaveBeenCalled()
  })
  it("does not convert unavailable or invalid stored data into defaults", async () => {
    result.error = { message: "private database details" }
    const response = await GET(request())
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain("private database")
    result = { data: { ...row, document: {} }, error: null }
    expect((await GET(request())).status).toBe(503)
  })
  it("saves using optimistic concurrency with session-scoped RPC and no client actor", async () => {
    const response = await PUT(request("PUT"))
    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith("save_procurement_policy", {
      p_site_id: siteId, p_expected_revision: 0, p_document: document,
    })
    expect(await response.json()).toEqual(row)
  })
  it("assigns rule versions independently of client-supplied versions", () => {
    const rule = procurementRuleSchema.parse({ id: "test", name: "Rule", type: "approval", event: "offer", version: 99 })
    const next = { ...document, rules: [rule] }
    expect(assignRuleVersions(next, null).rules[0].version).toBe(1)
    const previous = { ...document, rules: [{ ...rule, version: 3 }] }
    expect(assignRuleVersions(next, previous).rules[0].version).toBe(3)
    expect(assignRuleVersions({ ...next, rules: [{ ...rule, name: "Edited" }] }, previous).rules[0].version).toBe(4)
  })
  it("loads the expected snapshot within the authorized site before a subsequent save", async () => {
    result = { data: { document }, error: null }
    expect((await PUT(request("PUT", { expected_revision: 1, document }))).status).toBe(200)
    expect(query.eq).toHaveBeenCalledWith("revision", 1)
    expect(query.eq).toHaveBeenCalledWith("site_id", siteId)
    result = { data: null, error: null }
    expect((await PUT(request("PUT", { expected_revision: 1, document }))).status).toBe(409)
  })
  it.each([["40001", 409], ["42501", 403], ["22023", 400], ["PGRST202", 503]])("maps database %s without leaking internals", async (code, status) => {
    saveResult = { data: null, error: { code, message: "secret SQL" } }
    const response = await PUT(request("PUT"))
    expect(response.status).toBe(status)
    expect(JSON.stringify(await response.json())).not.toContain("secret SQL")
  })
  it("rejects cross-origin writes and non-JSON payloads", async () => {
    expect((await PUT(request("PUT", undefined, { origin: "https://other.test" }))).status).toBe(403)
    expect((await PUT(request("PUT", undefined, { "sec-fetch-site": "cross-site" }))).status).toBe(403)
    expect((await PUT(request("PUT", undefined, { "content-type": "text/plain" }))).status).toBe(415)
    expect(createClient).not.toHaveBeenCalled()
  })
  it("rejects forged actors, invalid schema and oversized bodies", async () => {
    expect((await PUT(request("PUT", { expected_revision: 0, document, created_by: userId }))).status).toBe(400)
    expect((await PUT(request("PUT", { expected_revision: -1, document }))).status).toBe(400)
    expect((await PUT(request("PUT", { document: "x".repeat(262145) }))).status).toBe(413)
    expect(rpc.mock.calls.some(([name]) => name === "save_procurement_policy")).toBe(false)
  })
  it("rejects malformed JSON", async () => {
    const req = new Request(request().url, { method: "PUT", headers: { cookie: "session=x", "content-type": "application/json" }, body: "{" })
    expect((await PUT(req)).status).toBe(400)
  })
  it("rejects foreign supervisors instead of trusting identifiers", async () => {
    result = { data: [], error: null }
    const response = await PUT(request("PUT", {
      expected_revision: 0, document: { ...document, settings: { ...document.settings, supervisorId: userId } },
    }))
    expect(response.status).toBe(400)
    expect(rpc.mock.calls.some(([name]) => name === "save_procurement_policy")).toBe(false)
  })
  it("allows archiving obsolete references but revalidates edits and reactivation", async () => {
    const old = procurementRuleSchema.parse({ id: "old-rule", name: "Historical rule", type: "approval", event: "offer",
      scope: { productIds: [siteId] } })
    result = { data: { document: { ...document, rules: [old] } }, error: null }
    const archived = { ...old, status: "archived" }
    expect((await PUT(request("PUT", { expected_revision: 1, document: { ...document, rules: [archived] } }))).status).toBe(200)
    expect(from.mock.calls.every(([table]) => table === "procurement_policy_versions")).toBe(true)
    // The saved snapshot exists, but catalog lookup fails: neither edits nor activation may skip it.
    query.then = jest.fn(resolve => Promise.resolve({ data: [], error: null }).then(resolve))
    for (const rule of [{ ...archived, name: "Changed" }, { ...archived, status: "draft" }]) {
      expect((await PUT(request("PUT", { expected_revision: 1, document: { ...document, rules: [rule] } }))).status).toBe(400)
    }
    expect(from).toHaveBeenCalledWith("catalog_items")
  })
  it("requires manager access and bounded inputs for references", async () => {
    const req = (kind: string) => new Request(`https://example.test/?site_id=${siteId}&kind=${kind}`, { headers: { cookie: "session=x" } })
    expect((await references(req("unknown"))).status).toBe(400)
    result = { data: [{ id: siteId, name: "Product", secret: "hidden" }], error: null }
    const response = await references(req("products"))
    expect(await response.json()).toEqual({ options: [{ id: siteId, label: "Product" }], has_more: false })
    expect(query.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(query.limit).toHaveBeenCalledWith(51)
  })
})