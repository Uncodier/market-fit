/** @jest-environment node */

import { POST } from "@/app/api/robots/instance/delete/route"
import { createClient } from "@/lib/supabase/server"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const siteId = "00000000-0000-4000-8000-000000000001"
const instanceId = "00000000-0000-4000-8000-000000000002"
const userId = "00000000-0000-4000-8000-000000000003"
const requirementId = "00000000-0000-4000-8000-000000000004"
const result = { success: true, instance_id: instanceId, deleted_requirement_ids: [requirementId] }
const auth = { getUser: jest.fn(), getSession: jest.fn() }
const rpc = jest.fn()
const query = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn() }
const from = jest.fn()
const originalApi = process.env.API_SERVER_URL
const originalPublicApi = process.env.NEXT_PUBLIC_API_SERVER_URL

function request(body: unknown = { instance_id: instanceId, delete_requirements: true }, headers = {}) {
  return new Request("http://localhost:3000/api/robots/instance/delete", {
    method: "POST",
    headers: { cookie: "sb-test=session", origin: "http://localhost:3000", "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, "error").mockImplementation(() => {})
  process.env.API_SERVER_URL = "http://localhost:3001"
  delete process.env.NEXT_PUBLIC_API_SERVER_URL
  jest.mocked(createClient).mockResolvedValue({ auth, from, rpc })
  auth.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null })
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: userId }, access_token: "verified-session" } }, error: null })
  rpc.mockImplementation(async (name: string) => ({ data: name === "user_can" ? true : "owner", error: null }))
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.maybeSingle.mockResolvedValue({ data: { id: instanceId, site_id: siteId }, error: null })
  from.mockReturnValue(query)
  jest.mocked(fetch).mockReset().mockResolvedValue(Response.json(result))
})

afterEach(() => jest.restoreAllMocks())

afterAll(() => {
  if (originalApi === undefined) delete process.env.API_SERVER_URL
  else process.env.API_SERVER_URL = originalApi
  if (originalPublicApi === undefined) delete process.env.NEXT_PUBLIC_API_SERVER_URL
  else process.env.NEXT_PUBLIC_API_SERVER_URL = originalPublicApi
})

it.each(["owner", "admin"])("allows project %s without requiring instance creator identity", async role => {
  rpc.mockImplementation(async name => ({ data: name === "user_can" ? true : role, error: null }))
  const response = await POST(request(undefined, { authorization: "Bearer forged", "x-api-key": "forged" }))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(result)
  expect(response.headers.get("cache-control")).toBe("no-store, private")
  expect(createClient).toHaveBeenCalledWith(true)
  expect(query.eq).toHaveBeenCalledWith("id", instanceId)
  expect(rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: siteId })
  expect(rpc).toHaveBeenCalledWith("user_can", { p_site_id: siteId, p_command: "delete" })
  expect(fetch).toHaveBeenCalledTimes(1)
  const [url, options] = jest.mocked(fetch).mock.calls[0]
  expect(String(url)).toBe("http://localhost:3001/api/robots/instance/delete")
  expect(options).toMatchObject({
    method: "POST", redirect: "error", cache: "no-store",
    headers: { Authorization: "Bearer verified-session", "Content-Type": "application/json", Accept: "application/json" },
  })
  expect(JSON.parse(String(options?.body))).toEqual({ instance_id: instanceId, delete_requirements: true })
  // No child cleanup or direct parent delete in this process.
  expect(from).toHaveBeenCalledTimes(1)
  expect(from).toHaveBeenCalledWith("remote_instances")
})

it.each([null, "marketing", "collaborator"])("rejects role %s before any downstream effect", async role => {
  rpc.mockResolvedValue({ data: role, error: null })
  expect((await POST(request())).status).toBe(403)
  expect(fetch).not.toHaveBeenCalled()
})

it("fails closed on a denied or unavailable delete capability", async () => {
  rpc.mockImplementation(async name => ({ data: name === "user_can" ? false : "owner", error: null }))
  expect((await POST(request())).status).toBe(403)
  rpc.mockResolvedValue({ data: "owner", error: { message: "private error" } })
  expect((await POST(request())).status).toBe(403)
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  { data: { user: null }, error: null },
  { data: { user: { id: userId } }, error: { message: "expired" } },
  { data: { user: { id: userId, is_anonymous: true } }, error: null },
])("requires a verified non-anonymous identity", async value => {
  auth.getUser.mockResolvedValue(value)
  expect((await POST(request())).status).toBe(401)
  expect(from).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it("hides RLS-invisible instances and fails closed on database read errors", async () => {
  query.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
  expect((await POST(request())).status).toBe(404)
  query.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "private db error" } })
  const response = await POST(request())
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain("private db error")
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  { data: { session: null }, error: null },
  { data: { session: { user: { id: siteId }, access_token: "wrong-session" } }, error: null },
  { data: { session: { user: { id: userId }, access_token: "" } }, error: null },
  { data: { session: { user: { id: userId }, access_token: "session" } }, error: { message: "expired" } },
])("does not forward an invalid or mismatched session", async value => {
  auth.getSession.mockResolvedValue(value)
  expect((await POST(request())).status).toBe(401)
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  "{", "null", "[]", {}, { instance_id: "bad", delete_requirements: true },
  { instance_id: instanceId }, { instance_id: instanceId, delete_requirements: false },
  { instance_id: instanceId, delete_requirements: true, site_id: siteId },
  { instance_id: instanceId, delete_requirements: true, user_id: userId },
  { instance_id: instanceId, delete_requirements: true, target: "https://evil.test" },
])("rejects invalid input or unconfirmed requirement deletion", async body => {
  expect((await POST(request(body))).status).toBe(400)
  expect(createClient).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it("bounds input and rejects cross-origin requests before authentication", async () => {
  expect((await POST(request({ padding: "x".repeat(4096) }))).status).toBe(413)
  expect((await POST(request(undefined, { "content-type": "text/plain" }))).status).toBe(415)
  expect((await POST(request(undefined, { origin: "https://evil.test" }))).status).toBe(403)
  expect((await POST(request(undefined, { "sec-fetch-site": "cross-site" }))).status).toBe(403)
  expect(createClient).not.toHaveBeenCalled()
})

it("never falls back to direct deletion when the external API is unavailable", async () => {
  delete process.env.API_SERVER_URL
  expect((await POST(request())).status).toBe(503)
  expect(fetch).not.toHaveBeenCalled()
  expect(from).toHaveBeenCalledTimes(1)
})

it.each([400, 401, 403, 404, 409, 429, 500, 503])("handles upstream %s without private errors or replay", async status => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ error: "private db details" }, { status }))
  const response = await POST(request())
  expect(response.status).toBe(status === 500 ? 502 : status)
  expect(await response.text()).not.toContain("private db details")
  expect(fetch).toHaveBeenCalledTimes(1)
})

it.each([
  { success: true }, { ...result, instance_id: siteId }, { ...result, success: false },
  { ...result, deleted_requirement_ids: ["bad"] },
])("does not claim completion from an invalid API receipt", async payload => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(payload))
  expect((await POST(request())).status).toBe(502)
})

it("does not retry after lost connections or non-JSON responses", async () => {
  jest.mocked(fetch).mockRejectedValueOnce(new Error("connection lost"))
  expect((await POST(request())).status).toBe(502)
  expect(fetch).toHaveBeenCalledTimes(1)
  jest.mocked(fetch).mockResolvedValueOnce(new Response("<html>error</html>"))
  expect((await POST(request())).status).toBe(502)
  expect(fetch).toHaveBeenCalledTimes(2)
})

it.each([
  [500, "deletion_failed", "database error"],
  [500, "AUTH_ERROR", "authentication"],
  [502, "provider_stop_failed", "No database deletion was attempted"],
  [503, "RATE_LIMIT_UNAVAILABLE", "admission"],
  [429, "RATE_LIMITED", "Too many requests"],
])("recognizes upstream %s/%s without exposing its private message", async (status, code, message) => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({
    success: false, error: { code, message: "private provider credential", details: "private SQL" },
  }, { status: Number(status) }))
  const response = await POST(request())
  const body = await response.json()
  expect(body.error.code).toBe(code)
  expect(body.error.message).toContain(message)
  expect(JSON.stringify(body)).not.toContain("private")
  expect(console.error).toHaveBeenCalledWith("[instance/delete proxy] Upstream failure", {
    upstream_status: status, upstream_code: code,
  })
  expect(fetch).toHaveBeenCalledTimes(1)
})

it.each([
  { success: false, error: { code: "unknown-private-code", message: "private" } },
  { success: true, error: { code: "deletion_failed", message: "private" } },
  { success: false, error: { code: "provider_stop_failed", message: "private" } },
])("keeps unknown, inconsistent or status-mismatched failures unconfirmed", async payload => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(payload, { status: 500 }))
  const response = await POST(request())
  expect(response.status).toBe(502)
  expect(await response.json()).toEqual({ success: false, error: {
    message: "Deletion could not be confirmed. Refresh the instance list before trying again.",
  } })
  expect(console.error).toHaveBeenCalledWith("[instance/delete proxy] Upstream failure", {
    upstream_status: 500, upstream_code: null,
  })
  expect(fetch).toHaveBeenCalledTimes(1)
})

it.each([
  new Response("{", { status: 500, headers: { "Content-Type": "application/json" } }),
  Response.json({ padding: "x".repeat(4096) }, { status: 500 }),
])("bounds and sanitizes malformed upstream error bodies", async upstream => {
  jest.mocked(fetch).mockResolvedValueOnce(upstream)
  const response = await POST(request())
  expect(response.status).toBe(502)
  expect((await response.json()).error.message).toContain("Deletion could not be confirmed")
  expect(fetch).toHaveBeenCalledTimes(1)
})