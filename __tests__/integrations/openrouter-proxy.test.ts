/** @jest-environment node */
import { randomBytes } from "node:crypto"
import { GET, POST } from "@/app/api/integrations/openrouter/route"
import { GET as getModels } from "@/app/api/integrations/openrouter/models/route"
import { GET as getSetup } from "@/app/api/integrations/openrouter/setup/route"
import { requireSiteAccess } from "@/lib/auth/api-site-access"

jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))
const siteId = "00000000-0000-4000-8000-000000000001"
const userId = "00000000-0000-4000-8000-000000000002"
const secret = randomBytes(32).toString("hex")
const token = randomBytes(32).toString("hex")
const getSession = jest.fn()
const originalApi = process.env.API_SERVER_URL
const originalPublicApi = process.env.NEXT_PUBLIC_API_SERVER_URL
const empty = { connection: null, canManage: true, rolloutEnabled: false, selectionMode: "manual", paidSelectionEnabled: false }
const connection = {
  id: userId, siteId, revision: 1, policyVersion: 1, credentialVersion: 1,
  status: "connected", selected: false, capabilities: {}, catalogUpdatedAt: null,
  verifiedAt: null, updatedAt: "2026-11-11T00:00:00Z",
}
function request(body: unknown = { operation: "connect", siteId, expectedRevision: 0, apiKey: secret, consent: true }, headers = {}) {
  return new Request("http://localhost:3000/api/integrations/openrouter", {
    method: "POST", headers: { cookie: "session", origin: "http://localhost:3000", "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
}
beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = "http://localhost:3001"
  delete process.env.NEXT_PUBLIC_API_SERVER_URL
  getSession.mockResolvedValue({ data: { session: { access_token: token, user: { id: userId } } }, error: null })
  jest.mocked(requireSiteAccess).mockResolvedValue({ userId, role: "owner", userEmail: null,
    supabase: { auth: { getSession } } as unknown as Awaited<ReturnType<typeof requireSiteAccess>>["supabase"] & {},
  })
  jest.mocked(fetch).mockReset().mockResolvedValue(Response.json(empty))
})
afterAll(() => {
  if (originalApi === undefined) delete process.env.API_SERVER_URL
  else process.env.API_SERVER_URL = originalApi
  if (originalPublicApi === undefined) delete process.env.NEXT_PUBLIC_API_SERVER_URL
  else process.env.NEXT_PUBLIC_API_SERVER_URL = originalPublicApi
})

it("authorizes managers and forwards only the session bearer to the fixed backend", async () => {
  expect((await POST(request())).status).toBe(200)
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), siteId, { requireManager: true })
  const [url, init] = jest.mocked(fetch).mock.calls[0]
  expect(String(url)).toBe("http://localhost:3001/api/integrations/openrouter")
  expect(init).toMatchObject({ redirect: "error", cache: "no-store", headers: { Authorization: `Bearer ${token}` } })
  expect(JSON.parse(init?.body as string)).toEqual({ operation: "connect", siteId, expectedRevision: 0, apiKey: secret, consent: true })
})

it('reports an unreachable backend after valid owner authorization without exposing connection errors', async () => {
  jest.mocked(fetch).mockRejectedValue(new Error(secret))
  const response = await GET(new Request(`http://localhost:3000/api/integrations/openrouter?siteId=${siteId}`))
  expect(response.status).toBe(502)
  expect(response.headers.get('X-OpenRouter-Error')).toBe('api_unavailable')
  const body = await response.text()
  expect(body).toContain('not a site-role denial')
  expect(body).not.toContain(secret)
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), siteId, { requireManager: true })
})

it.each([401, 403])("does not access the backend after an authorization denial (%s)", async status => {
  jest.mocked(requireSiteAccess).mockResolvedValue({ error: Response.json({}, { status }) as never })
  expect((await POST(request())).status).toBe(status)
  expect(fetch).not.toHaveBeenCalled()
  expect(getSession).not.toHaveBeenCalled()
})

it("rejects changed session identity", async () => {
  getSession.mockResolvedValue({ data: { session: { access_token: token, user: { id: siteId } } } })
  expect((await POST(request())).status).toBe(401)
  expect(fetch).not.toHaveBeenCalled()
})

it("rejects cross-origin mutations, excess bodies, malformed IDs and forged payer fields", async () => {
  expect((await POST(request(undefined, { origin: "https://evil.example" }))).status).toBe(403)
  expect((await POST(request(undefined, { "content-length": "20000" }))).status).toBe(413)
  expect((await POST(request({ operation: "disconnect", siteId: "bad", expectedRevision: 1 }))).status).toBe(400)
  expect((await POST(request({ operation: "configure", siteId, expectedRevision: 1, payer: "customer", skipBilling: true }))).status).toBe(400)
  expect(fetch).not.toHaveBeenCalled()
})

it("strips internal fields and refuses cross-site upstream DTOs", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ ...empty, apiKey: secret, connection: { ...connection, encryptedKey: secret } }))
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(response.headers.get("cache-control")).toContain("no-store")
  expect(await response.text()).not.toContain(secret)
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ ...empty, connection: { ...connection, siteId: userId } }))
  expect((await POST(request())).status).toBe(502)
})

it("returns safe conflict and provider errors without credentials and without replay", async () => {
  for (const status of [409, 429, 500]) {
    jest.mocked(fetch).mockResolvedValueOnce(Response.json({ error: secret }, { status }))
    const response = await POST(request())
    expect(response.status).toBe(status === 500 ? 502 : status)
    expect(await response.text()).not.toContain(secret)
  }
  expect(fetch).toHaveBeenCalledTimes(3)
})

it("does not forward unknown read parameters or duplicate sites", async () => {
  for (const query of [`siteId=${siteId}&siteId=${siteId}`, `siteId=${siteId}&apiKey=${secret}`]) {
    expect((await GET(new Request(`http://localhost:3000/api/integrations/openrouter?${query}`))).status).toBe(400)
  }
  expect(fetch).not.toHaveBeenCalled()
})

it("loads account catalog only through its fixed route with an allowlisted response", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ models: [{ id: "vendor/model", name: "Model", inputModalities: ["text"], outputModalities: ["text"], supportedParameters: ["tools"], contextLength: 10000, secret }], catalogUpdatedAt: null, secret }))
  const response = await getModels(new Request(`http://localhost:3000/api/integrations/openrouter/models?siteId=${siteId}`))
  expect(response.status).toBe(200)
  expect(String(jest.mocked(fetch).mock.calls[0][0])).toBe(`http://localhost:3001/api/integrations/openrouter/models?siteId=${siteId}`)
  expect(await response.text()).not.toContain(secret)
})

it("fails closed for missing backend and malformed upstream payloads", async () => {
  delete process.env.API_SERVER_URL
  expect((await POST(request())).status).toBe(503)
  expect(fetch).not.toHaveBeenCalled()
  process.env.API_SERVER_URL = "http://localhost:3001"
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ unexpected: secret }))
  expect((await POST(request())).status).toBe(502)
})

it("rejects oversized upstream DTOs without echoing the payload", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ secret }), {
    headers: { "content-type": "application/json", "content-length": "64001" },
  }))
  const response = await POST(request())
  expect(response.status).toBe(502)
  expect(await response.text()).not.toContain(secret)
})

it("requires explicit bounded setup consent and refuses forged verification evidence", async () => {
  const base = { operation: "verify", siteId, expectedRevision: 1, operationId: userId, capability: "image", modelId: "vendor/image", maxCostUsd: 0.25 }
  expect((await POST(request(base))).status).toBe(400)
  expect((await POST(request({ ...base, consent: true, maxCostUsd: 100 }))).status).toBe(400)
  expect((await POST(request({ ...base, consent: true, status: "available" }))).status).toBe(400)
  expect(fetch).not.toHaveBeenCalled()
  expect((await POST(request({ ...base, consent: true }))).status).toBe(200)
  expect(JSON.parse(jest.mocked(fetch).mock.calls[0][1]?.body as string)).toEqual({ ...base, consent: true })
})

it("setup status strips raw evidence and preserves unknown costs", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ runs: [{ operationId: userId, kind: "verify", state: "uncertain", maxCostUsd: 0.25, gatewayCost: null, createdAt: "now", finishedAt: null, platformCharge: 0, evidence: { secret } }] }))
  const response = await getSetup(new Request(`http://localhost:3000/api/integrations/openrouter/setup?siteId=${siteId}`))
  expect(response.status).toBe(200)
  const text = await response.text()
  expect(text).not.toContain(secret)
  expect(JSON.parse(text).runs[0].gatewayCost).toBeNull()
})