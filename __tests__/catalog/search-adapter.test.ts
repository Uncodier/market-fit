/** @jest-environment node */
import { createHmac, randomBytes, randomUUID } from "node:crypto"
import { searchCatalog, searchCatalogWindow } from "@/lib/catalog-search/server"
import { createClient } from "@/lib/supabase/server"
import { orderCatalogSearchRows } from "@/lib/catalog-search/types"
import { headers as requestHeaders } from "next/headers"

jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("next/headers", () => ({ headers: jest.fn() }))

const site = randomUUID()
const userId = randomUUID()
const token = randomBytes(32).toString("hex")
const serviceKey = randomBytes(32).toString("hex")
const items = [{ id: randomUUID(), site_id: site }, { id: randomUUID(), site_id: site }]
const result = { success: true, items, count: 2, count_kind: "candidate_window", has_more: false,
  mode: "hybrid", degraded: false, search_id: randomUUID() }
const request = { query: " running shoes ", channel: "catalog" as const, site_id: site }
const original = { api: process.env.API_SERVER_URL, service: process.env.SERVICE_API_KEY, vercel: process.env.VERCEL }
let fetchMock: jest.Mock
let rpc: jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = "https://api.example.invalid"
  process.env.SERVICE_API_KEY = serviceKey
  process.env.VERCEL = "1"
  jest.mocked(requestHeaders).mockResolvedValue(new Headers() as Awaited<ReturnType<typeof requestHeaders>>)
  fetchMock = jest.fn().mockImplementation(async () => Response.json(result))
  global.fetch = fetchMock
  rpc = jest.fn().mockResolvedValue({ data: "admin", error: null })
  jest.mocked(createClient).mockResolvedValue({ rpc, auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
    getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: token, user: { id: userId } } }, error: null }),
  } } as unknown as Awaited<ReturnType<typeof createClient>>)
})

afterAll(() => {
  if (original.api === undefined) delete process.env.API_SERVER_URL
  else process.env.API_SERVER_URL = original.api
  if (original.service === undefined) delete process.env.SERVICE_API_KEY
  else process.env.SERVICE_API_KEY = original.service
  if (original.vercel === undefined) delete process.env.VERCEL
  else process.env.VERCEL = original.vercel
})

it("validates session and site and forwards only the user's bearer to a fixed trusted URL", async () => {
  expect(await searchCatalog(request)).toEqual(result)
  expect(rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: site })
  const [target, init] = fetchMock.mock.calls[0]
  expect(String(target)).toBe("https://api.example.invalid/api/catalog/search")
  expect(init).toMatchObject({ method: "POST", redirect: "error", cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } })
  expect(init.headers).not.toHaveProperty("x-api-key")
  expect(init.headers).not.toHaveProperty("x-user-id")
  expect(init.headers).not.toHaveProperty("x-catalog-client-id")
  expect(requestHeaders).not.toHaveBeenCalled()
  expect(JSON.parse(init.body)).toEqual({ ...request, query: "running shoes", filters: {}, limit: 20, offset: 0 })
})

it.each(["shop", "marketplace"] as const)("uses only server service auth for public %s", async channel => {
  await searchCatalog({ ...request, channel })
  expect(createClient).not.toHaveBeenCalled()
  expect(fetchMock.mock.calls[0][1].headers).toEqual({ Accept: "application/json", "Content-Type": "application/json", "x-api-key": serviceKey })
})

it.each(["shop", "marketplace"] as const)("derives a stable private shopper bucket for %s, ignoring caller bucket headers", async channel => {
  const ip = "192.0.2.44"
  const spoofedBucket = randomBytes(32).toString("hex")
  const incoming = new Headers({ "x-vercel-forwarded-for": `${ip}, 192.0.2.45`, "x-catalog-client-id": spoofedBucket,
    "x-forwarded-for": "198.51.100.77", "x-real-ip": "198.51.100.88" })
  jest.mocked(requestHeaders).mockResolvedValue(incoming as Awaited<ReturnType<typeof requestHeaders>>)
  await searchCatalog({ ...request, channel })
  const outgoing = fetchMock.mock.calls[0][1].headers
  const bucket = outgoing["x-catalog-client-id"]
  expect(bucket).toMatch(/^[a-f0-9]{64}$/)
  expect(bucket).toBe(createHmac("sha256", serviceKey).update(`catalog-search-client:v1:${ip}`).digest("hex"))
  expect(bucket).not.toBe(spoofedBucket)
  expect(bucket).not.toContain(ip)
  expect(bucket).not.toContain(serviceKey)
  expect(bucket).not.toContain(token)
  expect(outgoing["x-api-key"]).toBe(serviceKey)
  for (const value of [ip, "192.0.2.45", "198.51.100.77", "198.51.100.88", spoofedBucket]) {
    expect(JSON.stringify(outgoing)).not.toContain(value)
  }
  incoming.set("x-catalog-client-id", randomBytes(32).toString("hex"))
  await searchCatalog({ ...request, channel })
  expect(fetchMock.mock.calls[1][1].headers["x-catalog-client-id"]).toBe(bucket)
  incoming.set("x-vercel-forwarded-for", "192.0.2.99")
  await searchCatalog({ ...request, channel })
  expect(fetchMock.mock.calls[2][1].headers["x-catalog-client-id"]).not.toBe(bucket)
})

it("omits shopper identity without trusted IP or request context, retaining aggregate service auth", async () => {
  const cases: Record<string, string>[] = [
    {}, { "x-vercel-forwarded-for": "unknown" },
    { "x-forwarded-for": "192.0.2.44", "x-real-ip": "192.0.2.44", "x-catalog-client-id": randomBytes(32).toString("hex") },
  ]
  for (const values of cases) {
    jest.mocked(requestHeaders).mockResolvedValue(new Headers(values) as Awaited<ReturnType<typeof requestHeaders>>)
    await searchCatalog({ ...request, channel: "shop" })
  }
  jest.mocked(requestHeaders).mockRejectedValueOnce(new Error("Outside request scope"))
  await searchCatalog({ ...request, channel: "shop" })
  for (const [, init] of fetchMock.mock.calls) {
    expect(init.headers["x-api-key"]).toBe(serviceKey)
    expect(init.headers).not.toHaveProperty("x-catalog-client-id")
  }
})

it("does not trust a spoofed edge header outside Vercel", async () => {
  delete process.env.VERCEL
  jest.mocked(requestHeaders).mockResolvedValue(new Headers({ "x-vercel-forwarded-for": "192.0.2.44" }) as Awaited<ReturnType<typeof requestHeaders>>)
  await searchCatalog({ ...request, channel: "marketplace" })
  expect(requestHeaders).not.toHaveBeenCalled()
  expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("x-catalog-client-id")
})

it("aligns the shared digital subtype boundary at 80 characters", async () => {
  await expect(searchCatalog({ ...request, filters: { digital_subtype: "x".repeat(80) } })).resolves.toEqual(result)
  await expect(searchCatalog({ ...request, filters: { digital_subtype: "x".repeat(81) } })).rejects.toMatchObject({ status: 400 })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it.each([{}, { query: " " }, { query: "x".repeat(201) }, { limit: 101 }, { offset: 201 },
  { site_id: "bad" }, { filters: { injected: true } }, { headers: { "x-user-id": "caller" } }])("rejects malformed search %j without fetch", async override => {
  const input = Object.keys(override).length ? { ...request, ...override } : {}
  await expect(searchCatalog(input as typeof request)).rejects.toMatchObject({ status: 400 })
  expect(fetchMock).not.toHaveBeenCalled()
})

it("denies foreign tenant before making any search request", async () => {
  rpc.mockResolvedValue({ data: null, error: null })
  await expect(searchCatalog(request)).rejects.toMatchObject({ status: 403 })
  expect(fetchMock).not.toHaveBeenCalled()
})

it("does not trust a session whose user differs from the verified identity", async () => {
  const client = await createClient()
  client.auth.getSession.mockResolvedValue({ data: { session: { access_token: token, user: { id: randomUUID() } } } })
  await expect(searchCatalog(request)).rejects.toMatchObject({ status: 401 })
  expect(fetchMock).not.toHaveBeenCalled()
})

it("fails closed without service credentials", async () => {
  delete process.env.SERVICE_API_KEY
  await expect(searchCatalog({ ...request, channel: "shop" })).rejects.toMatchObject({ status: 503 })
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each([401, 403, 409, 429, 500])("preserves access/rate errors and sanitizes upstream %i", async status => {
  fetchMock.mockResolvedValue(Response.json({ error: token, details: serviceKey }, { status }))
  const error = await searchCatalog(request).catch(error => error)
  expect(error.status).toBe(status === 500 ? 502 : status)
  expect(error.message).not.toContain(token)
  expect(error.message).not.toContain(serviceKey)
})

it.each([
  { count: 201 }, { count_kind: "exact" }, { mode: "other" }, { has_more: true },
  { items: [items[0], items[0]] }, { items: [{ ...items[0], site_id: randomUUID() }] },
])("rejects invalid or cross-site responses %j", async override => {
  fetchMock.mockResolvedValue(Response.json({ ...result, ...override }))
  await expect(searchCatalog(request)).rejects.toMatchObject({ status: 502 })
})

it("bounds response bytes, rejects HTML, and handles network failures without fallback", async () => {
  for (const response of [new Response("<html>"), new Response("x".repeat(64001), { headers: { "content-type": "application/json" } })]) {
    fetchMock.mockResolvedValueOnce(response)
    await expect(searchCatalog(request)).rejects.toMatchObject({ status: 502 })
  }
  fetchMock.mockRejectedValueOnce(new Error(token))
  await expect(searchCatalog(request)).rejects.toThrow("Catalog search is unavailable")
  expect(fetchMock).toHaveBeenCalledTimes(3)
})

it("rejects credential-bearing and unsafe configured targets without leaking secrets", async () => {
  const url = new URL("https://api.example.invalid")
  url.username = randomBytes(10).toString("hex")
  url.password = token
  for (const target of [url.toString(), "http://api.example.invalid", "https://api.example.invalid/path"]) {
    process.env.API_SERVER_URL = target
    const error = await searchCatalog(request).catch(error => error)
    expect(error.status).toBe(503)
    expect(error.message).not.toContain(url.username)
    expect(error.message).not.toContain(token)
  }
  expect(fetchMock).not.toHaveBeenCalled()
})

it("fetches at most 200 ordered candidates with two requests", async () => {
  const candidates = Array.from({ length: 200 }, () => ({ id: randomUUID(), site_id: site }))
  fetchMock.mockImplementation(async (_url, init) => {
    const { offset } = JSON.parse(init.body)
    return Response.json({ ...result, count: 200, items: candidates.slice(offset, offset + 100), has_more: offset === 0 })
  })
  const found = await searchCatalogWindow({ ...request, search_id: result.search_id })
  expect(found.items).toEqual(candidates)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).offset)).toEqual([0, 100])
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).search_id).toBe(result.search_id)
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).search_id).toBe(result.search_id)
})

it("never accepts a new first-window ID when the caller requested an older snapshot", async () => {
  await expect(searchCatalogWindow({ ...request, search_id: randomUUID() })).rejects.toMatchObject({ status: 409 })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it("rejects a changed continuation without retries or mixing rankings", async () => {
  const candidates = Array.from({ length: 101 }, () => ({ id: randomUUID(), site_id: site }))
  fetchMock.mockResolvedValueOnce(Response.json({ ...result, count: 101, items: candidates.slice(0, 100), has_more: true }))
    .mockResolvedValueOnce(Response.json({ ...result, count: 101, items: candidates.slice(100), search_id: randomUUID() }))
  await expect(searchCatalogWindow(request)).rejects.toMatchObject({ status: 409 })
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it("orders only authorized hydrated IDs with matching site ownership", () => {
  expect(orderCatalogSearchRows(items, [items[1], { ...items[0], site_id: randomUUID() }])).toEqual([items[1]])
})