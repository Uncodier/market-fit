/** @jest-environment node */

import { POST } from "@/app/api/chat/identity-token/route"
import { createClient } from "@/lib/supabase/server"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("next/server", () => ({ NextResponse: { json: (body: unknown, init: ResponseInit) => new Response(JSON.stringify(body), init) } }))

const sessionId = "00000000-0000-4000-8000-000000000001"
const env = { ...process.env }
const auth = { getUser: jest.fn(), getSession: jest.fn() }

function request(body: unknown = { session_id: sessionId }, headers: Record<string, string> = {}) {
  return new Request("https://app.makinari.com/api/chat/identity-token", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://app.makinari.com", cookie: "sb-test=session", "x-visitor-session-token": "widget-proof", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

describe("support chat identity issuance", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_API_SERVER_URL = "https://api.example.test"
    process.env.NEXT_PUBLIC_APP_URL = "https://app.makinari.com"
    ;(createClient as jest.Mock).mockResolvedValue({ auth })
    auth.getUser.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null })
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "verified-user" }, access_token: "supabase-proof" } }, error: null })
    ;(global.fetch as jest.Mock).mockReset().mockResolvedValue(new Response(JSON.stringify({
      success: true, data: { identity_token: "short-lived-token", expires_at: "2026-09-29T21:00:00.000Z", private_field: "never-forward" },
    }), { status: 200 }))
  })

  afterAll(() => { process.env = env })

  it("validates the auth user and forwards only the session proof, not profile identity", async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toContain("no-store")
    expect(createClient).toHaveBeenCalledWith(true)
    expect(auth.getUser).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith("https://api.example.test/api/visitors/identity/token/current-user", expect.objectContaining({
      redirect: "error", cache: "no-store", body: JSON.stringify({ session_id: sessionId }),
      headers: { "Content-Type": "application/json", Authorization: "Bearer supabase-proof", "x-visitor-session-token": "widget-proof" },
    }))
    expect(await response.json()).toEqual({ success: true, data: { identity_token: "short-lived-token", expires_at: "2026-09-29T21:00:00.000Z", user_id: "verified-user" } })
  })

  it.each(["https://attacker.test", "null", ""])('rejects untrusted origin "%s"', async (origin) => {
    expect((await POST(request(undefined, { origin }))).status).toBe(403)
    expect(createClient).not.toHaveBeenCalled()
  })

  it("rejects cross-site and missing cookie requests", async () => {
    expect((await POST(request(undefined, { "sec-fetch-site": "cross-site" }))).status).toBe(403)
    expect((await POST(request(undefined, { cookie: "" }))).status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it.each([{ user_id: "attacker" }, { site_id: sessionId }, { email: "victim@example.test" }, { return_url: "https://attacker.test" }])("rejects client identity overrides %s", async (extra) => {
    expect((await POST(request({ session_id: sessionId, ...extra }))).status).toBe(400)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("bounds body and session proof and rejects malformed requests", async () => {
    expect((await POST(request("x".repeat(1025)))).status).toBe(413)
    expect((await POST(request("{"))).status).toBe(400)
    expect((await POST(request({ session_id: "not-a-uuid" }))).status).toBe(400)
    expect((await POST(request(undefined, { "x-visitor-session-token": "" }))).status).toBe(400)
    expect((await POST(request(undefined, { "content-type": "text/plain" }))).status).toBe(415)
  })

  it.each([null, { id: "guest", is_anonymous: true }])("requires a real server-validated user", async (user) => {
    auth.getUser.mockResolvedValue({ data: { user }, error: null })
    expect((await POST(request())).status).toBe(401)
    expect(auth.getSession).not.toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("rejects mismatched sessions and auth errors", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "other-user" }, access_token: "wrong-proof" } }, error: null })
    expect((await POST(request())).status).toBe(401)
    auth.getUser.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: new Error("provider failure") })
    expect((await POST(request())).status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it.each(["http://attacker.test", "https://user:password@example.test", "", "https://api.example.test?redirect=https://attacker.test"])('fails closed for unsafe API config "%s"', async (url) => {
    process.env.NEXT_PUBLIC_API_SERVER_URL = url
    delete process.env.API_SERVER_URL
    expect((await POST(request())).status).toBe(503)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("sanitizes upstream denial, failure and invalid responses", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(new Response("private failure details", { status: 403 }))
    const denied = await POST(request())
    expect(denied.status).toBe(403)
    expect(await denied.text()).not.toContain("private failure")
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error("secret provider token"))
    expect((await POST(request())).status).toBe(503)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(new Response("{}"))
    expect((await POST(request())).status).toBe(502)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(new Response("x".repeat(17000)))
    expect((await POST(request())).status).toBe(503)
  })
})