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
const recoveryQuery = `site_id=${siteId}&include_recovery=1`
const futureBoundary = "2099-11-03T12:00:00+00:00"

function recoveryRead(boundary: unknown, error: unknown = null) {
  const billing = jest.fn().mockResolvedValue({ data: {
    stripe_customer_id: "cus_owned", stripe_subscription_id: "sub_owned",
  }, error: null })
  const query = { eq: jest.fn().mockReturnThis(), abortSignal: jest.fn().mockReturnThis(), maybeSingle: billing }
  const select = jest.fn().mockReturnValue(query)
  const userFrom = jest.fn().mockReturnValue({ select })
  jest.mocked(requireSiteAccess).mockResolvedValue({ userId: actorId, role: "owner", userEmail: null,
    supabase: { from: userFrom } } as never)
  rpc.mockImplementation((name: string) => name === "get_site_startup_trial"
    ? Promise.resolve({ data: eligible, error: null })
    : { abortSignal: () => Promise.resolve({ data: boundary, error }) })
  return { userFrom, select, query, billing }
}

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

it("only uses the authorized site's stored Stripe binding and returns just the verified date", async () => {
  const { userFrom, query } = recoveryRead(futureBoundary)
  const result = await GET(get(recoveryQuery))
  expect(result.status).toBe(200)
  expect(result.headers.get("cache-control")).toBe("no-store, private")
  expect(await result.json()).toEqual({ ...eligible, paid_through: futureBoundary })
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), siteId, {})
  expect(userFrom).toHaveBeenCalledWith("billing")
  expect(query.eq.mock.calls).toEqual([["site_id", siteId], ["subscription_status", "canceled"], ["auto_renew", false]])
  expect(rpc.mock.calls).toEqual([
    ["get_site_startup_trial", { p_site_id: siteId }],
    ["stripe_late_renewal_paid_through", { p_site_id: siteId, p_customer_id: "cus_owned", p_subscription_id: "sub_owned" }],
  ])
})

it.each([null, "garbage", "2000-01-01T00:00:00Z"])("omits unverified or expired coverage: %p", async boundary => {
  recoveryRead(boundary)
  expect(await (await GET(get(recoveryQuery))).json()).toEqual(eligible)
})

it("leaves the trial response intact if the recovery RPC fails", async () => {
  recoveryRead(futureBoundary, { code: "42883" })
  expect(await (await GET(get(recoveryQuery))).json()).toEqual(eligible)
})

it("does not call the recovery RPC without a matching billing binding", async () => {
  const { billing } = recoveryRead(futureBoundary)
  billing.mockResolvedValue({ data: null, error: null })
  expect(await (await GET(get(recoveryQuery))).json()).toEqual(eligible)
  expect(rpc).toHaveBeenCalledTimes(1)
})

it("skips recovery for non-owners and ordinary GETs", async () => {
  const { userFrom } = recoveryRead(futureBoundary)
  const owner = await jest.mocked(requireSiteAccess)(get(), siteId)
  expect(await (await GET(get())).json()).toEqual(eligible)
  jest.mocked(requireSiteAccess).mockResolvedValue({ ...owner, role: "admin" } as never)
  expect(await (await GET(get(recoveryQuery))).json()).toEqual(eligible)
  expect(userFrom).not.toHaveBeenCalled()
  expect(rpc.mock.calls.map(([name]) => name)).toEqual(["get_site_startup_trial", "get_site_startup_trial"])
})

it("rejects untrusted Stripe IDs and duplicate recovery flags before authorization", async () => {
  expect((await GET(get(`${recoveryQuery}&customer_id=cus_other`))).status).toBe(400)
  expect((await GET(get(`${recoveryQuery}&include_recovery=1`))).status).toBe(400)
  expect(requireSiteAccess).not.toHaveBeenCalled()
})

it.each([true, false])('returns only the explicit server offer decision without exposing payment history (%s)', async offer => {
  const dto = { ...eligible, state: offer ? 'eligible' : 'unavailable', offer_eligible: offer }
  rpc.mockResolvedValue({ data: { ...dto, payments: [{ amount: 99 }], primary_owner_id: 'private' }, error: null })
  const result = await GET(get())
  expect(result.status).toBe(200)
  expect(await result.json()).toEqual(dto)
  expect(from).not.toHaveBeenCalled()
})

it('fails closed for an offer flag inconsistent with trial state', async () => {
  rpc.mockResolvedValue({ data: { ...active, offer_eligible: true }, error: null })
  expect((await GET(get())).status).toBe(503)
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
  expect((await GET(get(recoveryQuery))).status).toBe(status)
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