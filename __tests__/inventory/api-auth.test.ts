/** @jest-environment node */
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { requireInventoryApiAccess } from "@/app/api/inventory/auth"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { lookupCurrentUserSiteRole, SiteRoleLookupError } from "@/lib/auth/site-role-lookup"

jest.mock("server-only", () => ({}))
jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))
jest.mock("@/lib/auth/site-role-lookup", () => ({
  lookupCurrentUserSiteRole: jest.fn(),
  SiteRoleLookupError: class extends Error { status = 503; constructor() { super("Site access unavailable") } },
}))

const siteId = "00000000-0000-4000-8000-000000000001"
const userId = "00000000-0000-4000-8000-000000000002"
function jwt(role = "authenticated", sub = userId) {
  return `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ role, sub })).toString("base64url")}.signature`
}
const token = jwt()
const client = { auth: { getUser: jest.fn() } }
const savedEnv = { ...process.env }
function request(authorization?: string) {
  return new Request("http://localhost/api/inventory/bulk", { headers: {
    cookie: "session=valid-cookie", ...(authorization === undefined ? {} : { authorization }),
  } })
}
beforeEach(() => {
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = jwt("anon")
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  jest.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)
  client.auth.getUser.mockResolvedValue({ data: { user: { id: userId, role: "authenticated", email: "actor@example.test", is_anonymous: false } }, error: null })
  jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue("collaborator")
})
afterAll(() => { process.env = savedEnv })

it("validates bearer token with Auth and supplies only user Authorization to RLS client", async () => {
  const access = await requireInventoryApiAccess(request(`Bearer ${token}`), siteId)
  expect(access.error).toBeUndefined()
  expect(access).toEqual({ supabase: client, role: "collaborator", userId, userEmail: "actor@example.test" })
  expect(client.auth.getUser).toHaveBeenCalledWith(token)
  expect(createClient).toHaveBeenCalledWith("https://example.supabase.co", jwt("anon"), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  expect(lookupCurrentUserSiteRole).toHaveBeenCalledWith(client, siteId)
  expect(requireSiteAccess).not.toHaveBeenCalled()
})

it("supports publishable public configuration without privileged credentials", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_offline_test"
  expect((await requireInventoryApiAccess(request(`Bearer ${token}`), siteId)).error).toBeUndefined()
  expect(createClient).toHaveBeenCalledWith(expect.any(String), "sb_publishable_offline_test", expect.any(Object))
})

it("preserves cookie flow only when Authorization is absent", async () => {
  const denial = { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  jest.mocked(requireSiteAccess).mockResolvedValue(denial)
  expect(await requireInventoryApiAccess(request(), siteId)).toBe(denial)
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), siteId, { allowLocationScoped: true })
  expect(createClient).not.toHaveBeenCalled()
})

it.each(["", "Basic credentials", "Bearer", "Bearer not-a-jwt", `Bearer ${token}, Bearer ${token}`, `Bearer ${jwt("service_role")}`, `Bearer ${jwt("anon")}`, `Bearer ${jwt("authenticated", "invalid")}`, `Bearer ${"x".repeat(17000)}.x.x`])("rejects malformed or non-user Authorization without cookie fallback", async authorization => {
  expect((await requireInventoryApiAccess(request(authorization), siteId)).error?.status).toBe(401)
  expect(requireSiteAccess).not.toHaveBeenCalled()
  expect(createClient).not.toHaveBeenCalled()
})

it("rejects invalid/expired bearer despite a valid cookie and hides provider errors", async () => {
  client.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "private provider detail" } })
  const response = (await requireInventoryApiAccess(request(`Bearer ${token}`), siteId)).error!
  expect(response.status).toBe(401)
  expect(await response.text()).not.toContain("provider")
  expect(requireSiteAccess).not.toHaveBeenCalled()
  expect(lookupCurrentUserSiteRole).not.toHaveBeenCalled()
})

it.each([{ role: "service_role", id: userId }, { role: "authenticated", id: siteId }, { role: "authenticated", id: userId, is_anonymous: true }])("denies identity/role mismatches after token verification", async user => {
  client.auth.getUser.mockResolvedValue({ data: { user }, error: null })
  expect((await requireInventoryApiAccess(request(`Bearer ${token}`), siteId)).error?.status).toBe(401)
  expect(lookupCurrentUserSiteRole).not.toHaveBeenCalled()
})

it("denies a bearer actor without trusted membership in the requested site", async () => {
  jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue(null)
  expect((await requireInventoryApiAccess(request(`Bearer ${token}`), siteId)).error?.status).toBe(403)
  expect(lookupCurrentUserSiteRole).toHaveBeenCalledWith(client, siteId)
})

it("fails closed on membership lookup failure", async () => {
  jest.mocked(lookupCurrentUserSiteRole).mockRejectedValue(new SiteRoleLookupError())
  expect((await requireInventoryApiAccess(request(`Bearer ${token}`), siteId)).error?.status).toBe(503)
})

it.each([jwt("service_role"), "sb_secret_forbidden", "invalid-public-key"])("refuses privileged or unrecognized public key configuration", async key => {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = key
  expect((await requireInventoryApiAccess(request(`Bearer ${token}`), siteId)).error?.status).toBe(503)
  expect(createClient).not.toHaveBeenCalled()
})