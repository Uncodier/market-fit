/** @jest-environment node */

import { NextResponse } from "next/server"
import { POST } from "@/app/api/agents/copywriter/content-editor/route"
import { requireSiteAccess } from "@/lib/auth/api-site-access"

jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))

const siteId = "00000000-0000-4000-8000-000000000001"
const contentId = "00000000-0000-4000-8000-000000000002"
const userId = "00000000-0000-4000-8000-000000000003"
const segmentId = "00000000-0000-4000-8000-000000000004"
const campaignId = "00000000-0000-4000-8000-000000000005"
const overrideId = "00000000-0000-4000-8000-000000000006"
const auth = { getSession: jest.fn() }
const from = jest.fn()
const rpc = jest.fn()
const saved = { id: contentId, site_id: siteId, segment_id: segmentId, campaign_id: campaignId }
const accepted = { success: true, data: {
  status: "completed", contentId, siteId, saved_to_database: true,
  edited_content: { title: "New title", description: "New summary", text: "New copy" },
} }
const originalApi = process.env.API_SERVER_URL
const originalPublicApi = process.env.NEXT_PUBLIC_API_SERVER_URL

function query(data: unknown, error: unknown = null) {
  const chain = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn().mockResolvedValue({ data, error }) }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  return chain
}

function request(body: unknown = {}, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/agents/copywriter/content-editor", {
    method: "POST",
    headers: { cookie: "sb-test=session", origin: "http://localhost:3000", "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify({ contentId, siteId, ...body as object }),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = "http://localhost:3001"
  delete process.env.NEXT_PUBLIC_API_SERVER_URL
  jest.mocked(requireSiteAccess).mockResolvedValue({
    userId, role: "owner", userEmail: null,
    supabase: { auth, from, rpc } as unknown as Awaited<ReturnType<typeof requireSiteAccess>>["supabase"] & {},
  })
  rpc.mockResolvedValue({ data: true, error: null })
  auth.getSession.mockResolvedValue({ data: { session: { access_token: "user-token", user: { id: userId } } }, error: null })
  from.mockReset().mockImplementation((table) => query(table === "content" ? saved
    : { id: table === "segments" ? segmentId : campaignId }))
  jest.mocked(fetch).mockReset().mockResolvedValue(Response.json(accepted))
})

afterAll(() => {
  if (originalApi === undefined) delete process.env.API_SERVER_URL
  else process.env.API_SERVER_URL = originalApi
  if (originalPublicApi === undefined) delete process.env.NEXT_PUBLIC_API_SERVER_URL
  else process.env.NEXT_PUBLIC_API_SERVER_URL = originalPublicApi
})

it("uses the verified user token, update capability and RLS-derived identities only", async () => {
  const response = await POST(request({
    userId: "forged-user", agent_id: "forged-agent", site_id: "forged-site",
    target: "https://evil.test", quickAction: "improve", aiPrompt: "Improve clarity",
    styleControls: { tone: "friendly", secret: "not allowed" },
  }, { authorization: "Bearer forged-token", "x-api-key": "forged-key" }))
  expect(response.status).toBe(200)
  expect(response.headers.get("cache-control")).toBe("no-store, private")
  expect(await response.json()).toEqual(accepted)
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), siteId)
  expect(rpc).toHaveBeenCalledWith("user_can", { p_site_id: siteId, p_command: "update" })
  for (const [index, id] of [contentId, segmentId, campaignId].entries()) {
    const chain = from.mock.results[index].value
    expect(chain.eq).toHaveBeenCalledWith("id", id)
    expect(chain.eq).toHaveBeenCalledWith("site_id", siteId)
  }
  const [target, init] = jest.mocked(fetch).mock.calls[0]
  expect(String(target)).toBe("http://localhost:3001/api/agents/copywriter/content-editor")
  expect(init).toMatchObject({
    method: "POST", cache: "no-store", redirect: "error", signal: expect.any(AbortSignal),
    headers: { Authorization: "Bearer user-token", "Content-Type": "application/json", Accept: "application/json" },
  })
  expect(JSON.parse(String(init?.body))).toEqual({
    contentId, siteId, userId, segmentId, campaignId, quickAction: "improve",
    aiPrompt: "Improve clarity", styleControls: { tone: "friendly" },
  })
  expect(fetch).toHaveBeenCalledTimes(1)
})

it.each([401, 403])("never forwards denied site access (%i)", async (status) => {
  jest.mocked(requireSiteAccess).mockResolvedValueOnce({ error: NextResponse.json({ error: "Denied" }, { status }) })
  expect((await POST(request())).status).toBe(status)
  expect(from).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it.each([{ data: false, error: null }, { data: true, error: { message: "private" } }])(
  "requires a successful update capability check", async (result) => {
    rpc.mockResolvedValueOnce(result)
    expect((await POST(request())).status).toBe(403)
    expect(from).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  },
)

it.each(["content", "segments", "campaigns"])("denies inaccessible/cross-site %s under user RLS", async (deniedTable) => {
  from.mockImplementation((table) => query(table === deniedTable ? null
    : table === "content" ? saved : { id: table === "segments" ? segmentId : campaignId }))
  expect((await POST(request())).status).toBe(404)
  expect(fetch).not.toHaveBeenCalled()
})

it("validates explicit context overrides as well as backend fallback relations", async () => {
  from.mockImplementation((table) => {
    if (table === "content") return query(saved)
    const chain = query(null)
    chain.eq.mockImplementation((key, id) => {
      if (key === "id") chain.maybeSingle.mockResolvedValue({ data: { id }, error: null })
      return chain
    })
    return chain
  })
  expect((await POST(request({ segmentId: overrideId, campaignId: overrideId }))).status).toBe(200)
  expect(from.mock.calls.map(([table]) => table)).toEqual(["content", "segments", "segments", "campaigns", "campaigns"])
  expect(JSON.parse(String(jest.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({
    segmentId: overrideId, campaignId: overrideId,
  })
})

it("rejects a cross-site override even when stored context is accessible", async () => {
  from.mockImplementation((table) => query(table === "content" ? saved : { id: segmentId }))
  expect((await POST(request({ segmentId: overrideId }))).status).toBe(404)
  expect(fetch).not.toHaveBeenCalled()
})

it("supports content without context, but fails closed on database errors", async () => {
  from.mockReturnValueOnce(query({ ...saved, segment_id: null, campaign_id: null }))
  expect((await POST(request())).status).toBe(200)
  expect(from).toHaveBeenCalledTimes(1)
  from.mockReturnValueOnce(query(null, { message: "private database detail" }))
  const response = await POST(request())
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain("private database detail")
  expect(fetch).toHaveBeenCalledTimes(1)
})

it.each([
  { data: { session: null }, error: null },
  { data: { session: { access_token: "", user: { id: userId } } }, error: null },
  { data: { session: { access_token: "token", user: { id: siteId } } }, error: null },
  { data: { session: { access_token: "token", user: { id: userId } } }, error: { message: "private" } },
])("requires a usable session belonging to the authenticated user", async (session) => {
  auth.getSession.mockResolvedValueOnce(session)
  expect((await POST(request())).status).toBe(401)
  expect(fetch).not.toHaveBeenCalled()
})

it("validates JSON, bounded input, style controls and origins before authorization", async () => {
  for (const body of ["{", "null", "[]", { siteId: "bad" }, { contentId: "bad" }, { segmentId: "bad" },
    { campaignId: "bad" }, { quickAction: "delete" }, { styleControls: { size: "enormous" } },
    { aiPrompt: "x".repeat(20_001) }]) {
    expect((await POST(request(body))).status).toBe(400)
  }
  expect((await POST(request({ padding: "x".repeat(128_000) }))).status).toBe(413)
  expect((await POST(request({}, { "content-length": "128001" }))).status).toBe(413)
  expect((await POST(request({}, { "content-type": "text/plain" }))).status).toBe(415)
  expect((await POST(request({}, { origin: "https://evil.test" }))).status).toBe(403)
  expect((await POST(request({}, { "sec-fetch-site": "cross-site" }))).status).toBe(403)
  expect(requireSiteAccess).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it.each([400, 401, 403, 404, 409, 429, 500, 503])("preserves upstream denial/failure %i without details or retries", async (status) => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ error: "private backend detail" }, { status }))
  const response = await POST(request())
  expect(response.status).toBe(status)
  expect(await response.text()).not.toContain("private backend detail")
  expect(fetch).toHaveBeenCalledTimes(1)
})

it("exposes only completed, saved edited content from the actual API response", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ ...accepted, provider: "private", data: {
    ...accepted.data, command_id: "internal", original_content: { text: "private original" },
    applied_actions: { quick_action: "improve" },
    edited_content: { ...accepted.data.edited_content, type: "blog_post", internal: "private" },
  } }))
  expect(await (await POST(request())).json()).toEqual(accepted)
})

it("never treats malformed, unsaved, pending or mismatched upstream results as success", async () => {
  const bodies = [{}, { success: true, message: "Accepted" }, { success: false },
    { ...accepted, data: { ...accepted.data, saved_to_database: false } },
    { ...accepted, data: { ...accepted.data, status: "running" } },
    { ...accepted, data: { ...accepted.data, contentId: siteId } },
    { ...accepted, data: { ...accepted.data, siteId: contentId } },
    { ...accepted, data: { ...accepted.data, edited_content: { ...accepted.data.edited_content, text: " " } } },
    { ...accepted, padding: "x".repeat(1_000_000) },
  ]
  for (const body of bodies) {
    jest.mocked(fetch).mockResolvedValueOnce(Response.json(body))
    expect((await POST(request())).status).toBe(502)
  }
  jest.mocked(fetch).mockResolvedValueOnce(new Response("html"))
  expect((await POST(request())).status).toBe(502)
  jest.mocked(fetch).mockRejectedValueOnce(new Error("private network error"))
  const response = await POST(request())
  expect(response.status).toBe(502)
  expect(await response.text()).not.toContain("private network error")
  expect(fetch).toHaveBeenCalledTimes(bodies.length + 2)
})

it("fails closed on unconfigured, recursive, credential-bearing or insecure API targets", async () => {
  for (const value of ["", "http://localhost:3000", "https://user:secret@api.example.test",
    "http://api.example.test", "https://api.example.test?target=x", "https://api.example.test/other"]) {
    process.env.API_SERVER_URL = value
    expect((await POST(request())).status).toBe(503)
  }
  expect(fetch).not.toHaveBeenCalled()
})