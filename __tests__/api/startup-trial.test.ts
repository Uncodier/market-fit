/** @jest-environment node */
import { GET, POST } from "@/app/api/billing/startup-trial/route"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { createServiceClient } from "@/lib/supabase/server"

jest.mock("server-only", () => ({}), { virtual: true })
jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))
jest.mock("@/lib/permissions/site-access", () => ({ userCanOnSite: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))

const siteId = "11111111-1111-4111-8111-111111111111"
const actorId = "22222222-2222-4222-8222-222222222222"
const now = "2026-10-19T12:00:00.000Z"
const active = { success: true, state: "active", started_at: now,
  ends_at: "2026-11-03T12:00:00.000Z", credits_remaining: 50, server_now: now }
const eligible = { success: true, state: "eligible", started_at: null, ends_at: null,
  credits_remaining: 0, server_now: now }
const rpc = jest.fn()
const from = jest.fn()
const post = (body: unknown = { site_id: siteId }, headers = {}) => new Request("https://app.example.test/api/billing/startup-trial", {
  method: "POST", headers: { cookie: "session=synthetic", "content-type": "application/json", ...headers }, body: JSON.stringify(body),
})
const get = (query = `site_id=${siteId}`, headers = {}) => new Request(`https://app.example.test/api/billing/startup-trial?${query}`, {
  headers: { cookie: "session=synthetic", ...headers },
})

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(requireSiteAccess).mockResolvedValue({ userId: actorId, role: "owner", userEmail: null, supabase: {} } as never)
  jest.mocked(userCanOnSite).mockResolvedValue(true)
  jest.mocked(createServiceClient).mockResolvedValue({ rpc, from } as never)
  rpc.mockResolvedValue({ data: { ...active, outcome: "started", private: "never returned" }, error: null })
})

it("GET never activates a trial and returns a private minimal status", async () => {
  rpc.mockResolvedValue({ data: { ...eligible, private: "hidden" }, error: null })
  const result = await GET(get())
  expect(result.status).toBe(200)
  expect(await result.json()).toEqual(eligible)
  expect(result.headers.get("cache-control")).toContain("no-store")
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), siteId, {})
  expect(rpc).toHaveBeenCalledWith("get_site_startup_trial", { p_site_id: siteId })
  expect(userCanOnSite).not.toHaveBeenCalled()
  expect(from).not.toHaveBeenCalled()
})

it("POST uses only server-verified actor identity and atomic activation", async () => {
  const result = await POST(post())
  expect(result.status).toBe(200)
  expect(await result.json()).toEqual({ ...active, outcome: "started" })
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), siteId, { requireManager: true })
  expect(userCanOnSite).toHaveBeenCalledWith({}, siteId, "update")
  expect(rpc).toHaveBeenCalledWith("start_site_startup_trial", { p_site_id: siteId, p_actor_id: actorId })
  expect(createServiceClient).toHaveBeenCalledWith(true)
  expect(from).not.toHaveBeenCalled()
})

it.each([401, 403])("denies unauthorized callers (%s) before elevated access", async status => {
  jest.mocked(requireSiteAccess).mockResolvedValue({ error: Response.json({ error: "Denied" }, { status }) } as never)
  expect((await GET(get())).status).toBe(status)
  expect((await POST(post())).status).toBe(status)
  expect(createServiceClient).not.toHaveBeenCalled()
})

it("denies managers without update capability", async () => {
  jest.mocked(userCanOnSite).mockResolvedValue(false)
  expect((await POST(post())).status).toBe(403)
  expect(createServiceClient).not.toHaveBeenCalled()
})

it.each([{}, { site_id: "demo-site" }, { site_id: siteId, actor_id: actorId },
  { site_id: siteId, credits: 100 }, { site_id: siteId, plan: "enterprise" },
  { site_id: siteId, ends_at: "2099-01-01" }])("rejects client lifecycle and financial fields %j", async body => {
  expect((await POST(post(body))).status).toBe(400)
  expect(requireSiteAccess).not.toHaveBeenCalled()
})

it.each(["", "site_id=invalid", `site_id=${siteId}&site_id=${siteId}`, `site_id=${siteId}&actor_id=${actorId}`])("rejects invalid or duplicate status queries %s", async query => {
  expect((await GET(get(query))).status).toBe(400)
  expect(createServiceClient).not.toHaveBeenCalled()
})

it("rejects untrusted origin, malformed, non-JSON and oversized bodies", async () => {
  expect((await POST(post(undefined, { origin: "https://evil.example.test" }))).status).toBe(403)
  expect((await GET(get(undefined, { "sec-fetch-site": "cross-site" }))).status).toBe(403)
  expect((await POST(post(undefined, { "content-type": "text/plain" }))).status).toBe(415)
  expect((await POST(post({ site_id: siteId, extra: "x".repeat(5000) }))).status).toBe(413)
  expect((await POST(new Request("https://app.example.test/api/billing/startup-trial", {
    method: "POST", headers: { "content-type": "application/json" }, body: "{",
  }))).status).toBe(400)
  expect(createServiceClient).not.toHaveBeenCalled()
})

it("accepts idempotent retry without refilling balances", async () => {
  rpc.mockResolvedValue({ data: { ...active, credits_remaining: 12.5, outcome: "already_started" }, error: null })
  for (const result of await Promise.all([POST(post()), POST(post())])) {
    expect(await result.json()).toEqual({ ...active, credits_remaining: 12.5, outcome: "already_started" })
  }
  expect(from).not.toHaveBeenCalled()
})

it.each(["PGRST202", "42883", "XX000"])("fails closed when required RPC is unavailable (%s)", async code => {
  rpc.mockResolvedValue({ data: null, error: { code, message: "Private database details" } })
  const result = await POST(post())
  expect(result.status).toBe(503)
  expect(JSON.stringify(await result.json())).not.toContain("Private database details")
})

it.each([["42501", 403], ["P0001", 409]])("maps safe database denial %s to %s", async (code, status) => {
  rpc.mockResolvedValue({ data: null, error: { code, message: "Private identity" } })
  expect((await POST(post())).status).toBe(status)
})

it.each(["not_eligible", "already_used"])("maps atomic eligibility outcome %s to safe conflict", async outcome => {
  rpc.mockResolvedValue({ data: { ...eligible, outcome, primary_owner_id: "hidden" }, error: null })
  const result = await POST(post())
  expect(result.status).toBe(409)
  expect(await result.json()).toEqual({ success: false, error: {
    code: "TRIAL_NOT_ELIGIBLE", message: expect.any(String),
  } })
})

it.each([null, {}, { ...active, credits_remaining: -1 }, { ...active, outcome: "unknown" },
  { ...eligible, outcome: "started" }, { ...active, outcome: "started", ends_at: null },
  { ...active, outcome: "started", server_now: "2099-01-01T00:00:00.000Z" }])("rejects unconfirmed activation payload %j", async data => {
  rpc.mockResolvedValue({ data, error: null })
  expect((await POST(post())).status).toBe(503)
})

it("sanitizes unexpected service failures", async () => {
  jest.mocked(createServiceClient).mockRejectedValue(new Error("Private service credentials"))
  const response = await GET(get())
  expect(response.status).toBe(503)
  expect(JSON.stringify(await response.json())).not.toContain("Private service credentials")
})