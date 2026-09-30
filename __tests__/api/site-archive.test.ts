/** @jest-environment node */
import { POST } from "@/app/api/sites/archive/route"
import { createClient as createAuthClient } from "@supabase/supabase-js"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { checkRateLimit, hashRedisKeyPart } from "@/lib/redis/control-plane"

jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock("@/lib/redis/control-plane", () => ({
  ...jest.requireActual("@/lib/redis/control-plane"),
  checkRateLimit: jest.fn(),
  hashRedisKeyPart: jest.fn(),
}))

const siteId = "00000000-0000-4000-8000-000000000001"
const userId = "00000000-0000-4000-8000-000000000002"
const password = " test-password-with-spaces "
let userClient: any
let siteQuery: any
let verifier: any
let admin: any

function request(body: unknown = { siteId, password }, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/sites/archive", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "sb-session=test", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-publishable-key"
  siteQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { user_id: userId, archived_at: null }, error: null }),
  }
  userClient = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: userId, email: "owner@example.test" } }, error: null }) },
    rpc: jest.fn().mockResolvedValue({ data: "owner", error: null }),
    from: jest.fn().mockReturnValue(siteQuery),
  }
  verifier = { auth: { signInWithPassword: jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) } }
  admin = { rpc: jest.fn().mockResolvedValue({ data: true, error: null }) }
  jest.mocked(createClient).mockResolvedValue(userClient)
  jest.mocked(createServiceClient).mockResolvedValue(admin)
  jest.mocked(createAuthClient).mockReturnValue(verifier)
  jest.mocked(hashRedisKeyPart).mockResolvedValue("user-hash")
  jest.mocked(checkRateLimit).mockResolvedValue({ allowed: true, limit: 5, remaining: 4, resetMs: 300000 })
})

it("archives only after authenticating, checking ownership and verifying the exact password", async () => {
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ success: true })
  expect(createClient).toHaveBeenCalledWith(true)
  expect(siteQuery.eq).toHaveBeenCalledWith("id", siteId)
  expect(verifier.auth.signInWithPassword).toHaveBeenCalledWith({ email: "owner@example.test", password })
  expect(createAuthClient).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  expect(checkRateLimit).toHaveBeenCalledWith("rl:v1:site-archive:user:user-hash", {
    limit: 5, windowSeconds: 300, failureMode: "closed",
  })
  expect(createServiceClient).toHaveBeenCalledWith(true)
  expect(admin.rpc).toHaveBeenCalledWith("archive_site", { p_site_id: siteId, p_actor_id: userId })
  expect(verifier.auth.signInWithPassword.mock.invocationCallOrder[0])
    .toBeLessThan(jest.mocked(createServiceClient).mock.invocationCallOrder[0])
})

it("rejects missing credentials before accessing Supabase", async () => {
  expect((await POST(request(undefined, { cookie: "" }))).status).toBe(401)
  expect(createClient).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
})

it("rejects an expired session", async () => {
  userClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
  expect((await POST(request())).status).toBe(401)
  expect(createAuthClient).not.toHaveBeenCalled()
})

it.each([null, "marketing", "collaborator"])("rejects cross-tenant or non-manager role %s", async (role) => {
  userClient.rpc.mockResolvedValue({ data: role, error: null })
  expect((await POST(request())).status).toBe(403)
  expect(userClient.from).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
})

it.each(["admin", "owner"])("rejects a delegated %s who is not the actual owner", async (role) => {
  userClient.rpc.mockResolvedValue({ data: role, error: null })
  siteQuery.maybeSingle.mockResolvedValue({ data: { user_id: "other-user" }, error: null })
  expect((await POST(request())).status).toBe(403)
  expect(createAuthClient).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
})

it.each([
  { siteId, password: "" },
  { siteId: "demo-site", password },
  { siteId, password: 123 },
  { siteId, password: "x".repeat(1025) },
  { siteId, password, userId: "forged" },
  { siteId, password, email: "other@example.test" },
  "{invalid-json",
])("rejects malformed input without checking passwords", async (body) => {
  expect((await POST(request(body))).status).toBe(400)
  expect(createClient).not.toHaveBeenCalled()
  expect(createAuthClient).not.toHaveBeenCalled()
})

it("rejects oversized streaming bodies and incorrect content types", async () => {
  expect((await POST(request("x".repeat(8193)))).status).toBe(413)
  expect((await POST(request(undefined, { "content-length": "9000" }))).status).toBe(413)
  expect((await POST(request(undefined, { "content-type": "text/plain" }))).status).toBe(415)
  expect(createServiceClient).not.toHaveBeenCalled()
})

it.each([false, true])("fails closed on throttling or unavailable admission (%s)", async (unavailable) => {
  jest.mocked(checkRateLimit).mockResolvedValue({ allowed: false, unavailable, limit: 5, remaining: 0, resetMs: 300000 })
  expect((await POST(request())).status).toBe(unavailable ? 503 : 429)
  expect(createAuthClient).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
})

it.each([
  { data: { user: null }, error: { message: "secret provider detail" } },
  { data: { user: { id: "other-user" } }, error: null },
])("rejects incorrect passwords and mismatched verified identities", async (result) => {
  verifier.auth.signInWithPassword.mockResolvedValue(result)
  const response = await POST(request())
  expect(response.status).toBe(403)
  expect(JSON.stringify(await response.json())).not.toContain("secret provider detail")
  expect(createServiceClient).not.toHaveBeenCalled()
})

it("does not mutate when the owner has no email/password identity", async () => {
  userClient.auth.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null })
  expect((await POST(request())).status).toBe(400)
  expect(createAuthClient).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
})

it("rejects an archived site and reports database failures without leaking details", async () => {
  siteQuery.maybeSingle.mockResolvedValueOnce({ data: { user_id: userId, archived_at: "2026-09-29" }, error: null })
  expect((await POST(request())).status).toBe(409)
  expect(createServiceClient).not.toHaveBeenCalled()

  admin.rpc.mockResolvedValueOnce({ data: null, error: { message: "secret SQL detail" } })
  const response = await POST(request())
  expect(response.status).toBe(500)
  expect(JSON.stringify(await response.json())).not.toContain("secret SQL detail")
})

it("does not report success for an empty RPC result", async () => {
  admin.rpc.mockResolvedValue({ data: null, error: null })
  expect((await POST(request())).status).toBe(500)
})

it("fails closed if ownership cannot be read", async () => {
  siteQuery.maybeSingle.mockResolvedValue({ data: null, error: { message: "database unavailable" } })
  expect((await POST(request())).status).toBe(503)
  expect(createServiceClient).not.toHaveBeenCalled()
})

it.each(["40P01", "40001"])("retries a confirmed transaction rollback (%s), without repeating password verification", async (code) => {
  admin.rpc.mockResolvedValueOnce({ data: null, error: { code } })
  expect((await POST(request())).status).toBe(200)
  expect(admin.rpc).toHaveBeenCalledTimes(2)
  expect(verifier.auth.signInWithPassword).toHaveBeenCalledTimes(1)
})

it("bounds transaction retries and does not retry ambiguous failures", async () => {
  admin.rpc.mockResolvedValue({ data: null, error: { code: "40P01" } })
  expect((await POST(request())).status).toBe(500)
  expect(admin.rpc).toHaveBeenCalledTimes(3)
  admin.rpc.mockReset().mockResolvedValue({ data: null, error: { message: "network error" } })
  expect((await POST(request())).status).toBe(500)
  expect(admin.rpc).toHaveBeenCalledTimes(1)
})