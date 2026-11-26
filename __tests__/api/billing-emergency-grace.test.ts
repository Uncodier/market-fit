/** @jest-environment node */
import { POST } from "@/app/api/billing/emergency-grace/route"
import { requireSiteAccess } from "@/lib/auth/api-site-access"

jest.mock("server-only", () => ({}), { virtual: true })
jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))

const siteId = "11111111-1111-4111-8111-111111111111"
const url = "https://app.example.test/api/billing/emergency-grace"
const body = JSON.stringify({ site_id: siteId })
const end = "2026-12-01T12:00:00+00:00"
const rpc = jest.fn()
const maybeSingle = jest.fn()
const eq = jest.fn(() => ({ maybeSingle }))
const select = jest.fn(() => ({ eq }))
const from = jest.fn(() => ({ select }))
const access = { role: "owner", userId: "owner", userEmail: null, supabase: { rpc, from } }

function request(input = body, headers: Record<string, string> = {}) {
  return new Request(url, { method: "POST", body: input, headers: { "Content-Type": "application/json", ...headers } })
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(requireSiteAccess).mockResolvedValue(access as never)
  maybeSingle.mockResolvedValue({ data: { user_id: access.userId }, error: null })
  rpc.mockResolvedValue({ data: { outcome: "granted", plan: "foundry", ends_at: end }, error: null })
})

it.each([
  [body, { Origin: "https://other.example.test" }, 403],
  [body, { "Sec-Fetch-Site": "cross-site" }, 403],
  [body, { "Content-Type": "text/plain" }, 415],
  ["xyz", {}, 400],
  [JSON.stringify({ site_id: "invalid" }), {}, 400],
  [JSON.stringify({ site_id: siteId, actor_id: "other", plan: "enterprise", days: 100 }), {}, 400],
  [" ".repeat(1025), {}, 413],
])("rejects invalid input before authorization (%#)", async (input, headers, status) => {
  expect((await POST(request(input, headers as Record<string, string>))).status).toBe(status)
  expect(requireSiteAccess).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
})

it.each([401, 403, 503])("fails closed when the scoped access check returns %s", async status => {
  jest.mocked(requireSiteAccess).mockResolvedValueOnce({ error: new Response("internal", { status }) } as never)
  const response = await POST(request())
  expect(response.status).toBe(status)
  expect(await response.text()).not.toContain("internal")
  expect(from).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
})

it.each(["admin", "member", "viewer"])("does not allow a %s to reach the owner mutation", async role => {
  jest.mocked(requireSiteAccess).mockResolvedValueOnce({ ...access, role } as never)
  expect((await POST(request())).status).toBe(403)
  expect(from).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
})

it("denies delegated owners and missing projects before calling the RPC", async () => {
  maybeSingle.mockResolvedValueOnce({ data: { user_id: "different-owner" }, error: null })
    .mockResolvedValueOnce({ data: null, error: null })
  expect((await POST(request())).status).toBe(403)
  expect((await POST(request())).status).toBe(403)
  expect(rpc).not.toHaveBeenCalled()
})

it.each(["granted", "already_granted"])("returns only the confirmed %s response", async outcome => {
  rpc.mockResolvedValueOnce({ data: { outcome, plan: "foundry", ends_at: end, private: "hidden" }, error: null })
  const post = request(body, { Origin: "https://app.example.test" })
  const response = await POST(post)
  expect(response.status).toBe(200)
  expect(response.headers.get("cache-control")).toBe("private, no-store")
  expect(await response.json()).toEqual({ outcome, plan: "foundry", ends_at: end })
  expect(requireSiteAccess).toHaveBeenCalledWith(post, siteId, { requireManager: true })
  expect(from).toHaveBeenCalledWith("sites")
  expect(select).toHaveBeenCalledWith("user_id")
  expect(eq).toHaveBeenCalledWith("id", siteId)
  expect(rpc.mock.calls).toEqual([["grant_emergency_grace", { p_business_id: siteId }]])
})

it.each([
  ["forbidden", "FORBIDDEN", 403],
  ["ineligible", "GRACE_INELIGIBLE", 409],
  ["limit_reached", "GRACE_LIMIT_REACHED", 409],
])("honors the transaction's %s outcome", async (outcome, code, status) => {
  rpc.mockResolvedValueOnce({ data: { outcome, detail: "private" }, error: null })
  const response = await POST(request())
  expect(response.status).toBe(status)
  expect(await response.json()).toEqual({ error: { code, message: expect.any(String) } })
})

it.each([
  { data: null, error: { code: "42883", message: "private" } },
  { data: { outcome: "granted", plan: "commission", ends_at: end }, error: null },
  { data: { outcome: "granted", plan: "foundry", ends_at: "tomorrow" }, error: null },
])("fails closed without reflecting provider output", async result => {
  rpc.mockResolvedValueOnce(result)
  const response = await POST(request())
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ error: { code: "GRACE_UNAVAILABLE", message: expect.any(String) } })
})