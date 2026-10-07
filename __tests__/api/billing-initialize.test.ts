/** @jest-environment node */
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { createServiceClient } from "@/lib/supabase/server"
import { POST } from "@/app/api/billing/initialize/route"

jest.mock("server-only", () => ({}), { virtual: true })
jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))
jest.mock("@/lib/permissions/site-access", () => ({ userCanOnSite: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))

const siteId = "11111111-1111-4111-8111-111111111111"
const billing = { billing_id: "22222222-2222-4222-8222-222222222222", credits_granted: 1, credits_available: 1 }
const rpc = jest.fn()
const from = jest.fn()
const request = (body: unknown = { site_id: siteId }, headers = {}) => new Request("https://app.example.test/api/billing/initialize", {
  method: "POST", headers: { "content-type": "application/json", cookie: "session=synthetic", ...headers },
  body: JSON.stringify(body),
})

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(requireSiteAccess).mockResolvedValue({ userId: "owner", role: "owner", userEmail: null, supabase: {} })
  jest.mocked(userCanOnSite).mockResolvedValue(true)
  jest.mocked(createServiceClient).mockResolvedValue({ rpc, from } as never)
  rpc.mockResolvedValue({ data: { success: true, outcome: "initialized", ...billing, private: "not returned" }, error: null })
})

it.each([401, 403])("preserves authentication/authorization denial %s before service access", async status => {
  jest.mocked(requireSiteAccess).mockResolvedValue({ error: Response.json({ error: "Denied" }, { status }) as never })
  expect((await POST(request())).status).toBe(status)
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), siteId, { requireManager: true })
  expect(userCanOnSite).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
})

it("denies read-only manager capability before service access", async () => {
  jest.mocked(userCanOnSite).mockResolvedValue(false)
  expect((await POST(request())).status).toBe(403)
  expect(userCanOnSite).toHaveBeenCalledWith({}, siteId, "update")
  expect(createServiceClient).not.toHaveBeenCalled()
})

it.each([{ site_id: "demo-site" }, { site_id: "not-a-uuid" }, { site_id: siteId, credits: 30 }, { site_id: siteId, user_id: "forged" }, {}])("rejects invalid UUIDs and extra financial/actor fields: %j", async input => {
  expect((await POST(request(input))).status).toBe(400)
  expect(requireSiteAccess).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
})

it("rejects cross-origin and non-JSON requests", async () => {
  expect((await POST(request(undefined, { origin: "https://evil.example.test" }))).status).toBe(403)
  expect((await POST(request(undefined, { "sec-fetch-site": "cross-site" }))).status).toBe(403)
  expect((await POST(request(undefined, { "content-type": "text/plain" }))).status).toBe(415)
  expect(requireSiteAccess).not.toHaveBeenCalled()
})

it("limits the body before authorization", async () => {
  expect((await POST(request({ site_id: siteId, extra: "a".repeat(5_000) }))).status).toBe(413)
  expect(createServiceClient).not.toHaveBeenCalled()
})

it("rejects malformed JSON before any privileged access", async () => {
  const malformed = new Request("https://app.example.test/api/billing/initialize", {
    method: "POST", headers: { "content-type": "application/json" }, body: "{",
  })
  expect((await POST(malformed)).status).toBe(400)
  expect(requireSiteAccess).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
})

it("calls only the atomic RPC after authorization and returns a minimal result", async () => {
  const result = await POST(request())
  expect(result.status).toBe(200)
  expect(await result.json()).toEqual({ success: true, outcome: "initialized" })
  expect(result.headers.get("cache-control")).toContain("no-store")
  expect(createServiceClient).toHaveBeenCalledWith(true)
  expect(rpc).toHaveBeenCalledWith("initialize_site_billing", { p_site_id: siteId })
  expect(jest.mocked(userCanOnSite).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(createServiceClient).mock.invocationCallOrder[0])
  expect(from).not.toHaveBeenCalled()
})

it("accepts idempotent retries and concurrent requests without application balance writes", async () => {
  rpc.mockResolvedValue({ data: { success: true, outcome: "already_initialized", ...billing, credits_granted: 0 }, error: null })
  const results = await Promise.all([POST(request()), POST(request())])
  for (const result of results) expect(await result.json()).toEqual({ success: true, outcome: "already_initialized" })
  expect(rpc).toHaveBeenCalledTimes(2)
  expect(from).not.toHaveBeenCalled()
})

it.each(["PGRST202", "42883"])("explicitly reports missing RPC %s without fallback", async code => {
  rpc.mockResolvedValue({ data: null, error: { code, message: "Private database details" } })
  const result = await POST(request())
  expect(result.status).toBe(503)
  expect(await result.json()).toEqual({ success: false, error: {
    code: "BILLING_INITIALIZATION_UNAVAILABLE",
    message: expect.stringContaining("Your project is saved"),
  } })
  expect(from).not.toHaveBeenCalled()
})

it.each([
  { data: null, error: { code: "XX000", message: "Private error" } },
  { data: { success: false, error: "Private error" }, error: null },
  { data: { success: true }, error: null },
  { data: { success: true, outcome: "initialized", ...billing, billing_id: "invalid" }, error: null },
  { data: { success: true, outcome: "initialized", ...billing, credits_available: -1 }, error: null },
  { data: { success: true, outcome: "initialized", ...billing, credits_granted: Infinity }, error: null },
  { data: null, error: null },
])("fails closed for RPC failure or unconfirmed payload %j", async response => {
  rpc.mockResolvedValue(response)
  const result = await POST(request())
  expect(result.status).toBe(503)
  expect(JSON.stringify(await result.json())).not.toContain("Private error")
  expect(from).not.toHaveBeenCalled()
})

it("safely reports unexpected service failure", async () => {
  jest.mocked(createServiceClient).mockRejectedValue(new Error("Private service key"))
  const result = await POST(request())
  expect(result.status).toBe(503)
  expect(JSON.stringify(await result.json())).not.toContain("Private service key")
})