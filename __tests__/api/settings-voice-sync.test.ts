/** @jest-environment node */

import { after } from "next/server"
import { POST } from "@/app/api/settings/voice-sync/route"
import { requireSiteAccess } from "@/lib/auth/api-site-access"

jest.mock("next/server", () => ({ after: jest.fn() }))
jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))

const siteId = "00000000-0000-4000-8000-000000000001"
const userId = "00000000-0000-4000-8000-000000000002"
const getSession = jest.fn()
const rpc = jest.fn()
const originalApi = process.env.API_SERVER_URL
const originalPublicApi = process.env.NEXT_PUBLIC_API_SERVER_URL

function request(body: unknown = { siteId }, headers = {}) {
  return new Request("http://localhost:3000/api/settings/voice-sync", {
    method: "POST",
    headers: { cookie: "session", origin: "http://localhost:3000", "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

function backgroundWork() {
  return jest.mocked(after).mock.calls[0][0] as () => Promise<void>
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = "https://api.example.test"
  delete process.env.NEXT_PUBLIC_API_SERVER_URL
  getSession.mockResolvedValue({ data: { session: { access_token: "user-token", user: { id: userId } } }, error: null })
  rpc.mockResolvedValue({ data: true, error: null })
  jest.mocked(requireSiteAccess).mockResolvedValue({
    userId, role: "owner", userEmail: null,
    supabase: { auth: { getSession }, rpc } as unknown as Awaited<ReturnType<typeof requireSiteAccess>>["supabase"] & {},
  })
  jest.mocked(fetch).mockReset().mockResolvedValue(Response.json({ success: true, synced: true }))
  jest.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => jest.restoreAllMocks())
afterAll(() => {
  if (originalApi === undefined) delete process.env.API_SERVER_URL
  else process.env.API_SERVER_URL = originalApi
  if (originalPublicApi === undefined) delete process.env.NEXT_PUBLIC_API_SERVER_URL
  else process.env.NEXT_PUBLIC_API_SERVER_URL = originalPublicApi
})

it("accepts before provider work and preserves a pending real authenticated sync after the response", async () => {
  let finishSync!: (response: Response) => void
  jest.mocked(fetch).mockReturnValue(new Promise(resolve => { finishSync = resolve }))

  const response = await POST(request(undefined, { authorization: "Bearer forged", "x-api-key": "forged" }))
  expect(response.status).toBe(202)
  expect(await response.json()).toEqual({ success: true, status: "accepted" })
  expect(response.headers.get("cache-control")).toBe("no-store, private")
  expect(fetch).not.toHaveBeenCalled()
  expect(after).toHaveBeenCalledTimes(1)
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), siteId)
  expect(rpc).toHaveBeenCalledWith("user_can", { p_site_id: siteId, p_command: "update" })

  let completed = false
  const work = backgroundWork()().then(() => { completed = true })
  expect(completed).toBe(false)
  const [url, options] = jest.mocked(fetch).mock.calls[0]
  expect(String(url)).toBe("https://api.example.test/api/integrations/zavu/voice")
  expect(options).toMatchObject({ method: "PATCH", redirect: "error", cache: "no-store", signal: expect.any(AbortSignal) })
  expect(options?.headers).toEqual({ Authorization: "Bearer user-token", "Content-Type": "application/json", Accept: "application/json" })
  expect(JSON.parse(String(options?.body))).toEqual({ siteId })

  finishSync(Response.json({ success: true, synced: true }))
  await work
  expect(completed).toBe(true)
})

it.each([401, 403])("does not schedule unauthorized or cross-tenant requests (%i)", async status => {
  jest.mocked(requireSiteAccess).mockResolvedValueOnce({ error: Response.json({}, { status }) as never })
  expect((await POST(request())).status).toBe(status)
  expect(after).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it("requires mutation permission and a matching authenticated session", async () => {
  rpc.mockResolvedValueOnce({ data: false, error: null })
  expect((await POST(request())).status).toBe(403)
  getSession.mockResolvedValueOnce({ data: { session: null }, error: null })
  expect((await POST(request())).status).toBe(401)
  getSession.mockResolvedValueOnce({ data: { session: { access_token: "other", user: { id: "other" } } }, error: null })
  expect((await POST(request())).status).toBe(401)
  getSession.mockResolvedValueOnce({ data: { session: { access_token: "stale", user: { id: userId } } }, error: new Error("Expired") })
  expect((await POST(request())).status).toBe(401)
  expect(after).not.toHaveBeenCalled()
})

it("rejects malformed, oversized, foreign-origin and unsupported input before authorization", async () => {
  for (const body of ["{", {}, { siteId: "bad" }, { siteId, target: "https://evil.test" }, { siteId, preferences: {} }]) {
    expect((await POST(request(body))).status).toBe(400)
  }
  expect((await POST(request({ siteId, padding: "x".repeat(5_000) }))).status).toBe(413)
  expect((await POST(request(undefined, { origin: "https://evil.test" }))).status).toBe(403)
  expect((await POST(request(undefined, { "sec-fetch-site": "cross-site" }))).status).toBe(403)
  expect((await POST(request(undefined, { "content-type": "text/plain" }))).status).toBe(415)
  expect(requireSiteAccess).not.toHaveBeenCalled()
  expect(after).not.toHaveBeenCalled()
})

it.each(["", "http://localhost:3000", "https://user:secret@api.example.test", "https://api.example.test/other"])(
  "refuses missing, self-referencing or unsafe API configuration: %s", async configured => {
    process.env.API_SERVER_URL = configured
    expect((await POST(request())).status).toBe(503)
    expect(after).not.toHaveBeenCalled()
  },
)

it.each([401, 403, 500])("contains background HTTP %i without replay or exposing the provider response", async status => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ error: "private-provider-detail" }, { status }))
  const response = await POST(request())
  await expect(backgroundWork()()).resolves.toBeUndefined()
  expect(response.status).toBe(202)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(console.error).toHaveBeenCalledWith("Voice agent background synchronization failed", { siteId, status })
  expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain("private-provider-detail")
})

it("contains network/timeout failure and does not tie background work to the browser signal", async () => {
  jest.mocked(fetch).mockRejectedValueOnce(new Error("private-network-detail"))
  const input = request()
  await POST(input)
  await expect(backgroundWork()()).resolves.toBeUndefined()
  expect(jest.mocked(fetch).mock.calls[0][1]?.signal).not.toBe(input.signal)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain("private-network-detail")
})