/** @jest-environment node */
import { randomBytes } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { proxyConnector } from "@/app/api/connectors/proxy"
import { createClient } from "@/lib/supabase/server"
import { readAttemptCookie, setAttemptCookie } from "@/app/api/connectors/attempt-cookie"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const siteId = "11111111-1111-4111-8111-111111111111"
const userId = "22222222-2222-4222-8222-222222222222"
const attemptId = "33333333-3333-4333-8333-333333333333"
const auth = createClient as jest.Mock
const getUser = jest.fn()
const getSession = jest.fn()
const rpc = jest.fn()
const fetchMock = jest.fn()
const credential = randomBytes(32).toString("hex")
const previousFetch = global.fetch
const previousUrl = process.env.API_SERVER_URL

function request(path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`https://app.example.test/api/connectors/${path}`, {
    method, headers: { origin: "https://app.example.test", "content-type": "application/json", ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = "https://api.example.test"
  global.fetch = fetchMock
  rpc.mockResolvedValue({ data: [{ can_view: true, can_manage: true }], error: null })
  getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null })
  getSession.mockResolvedValue({ data: { session: { access_token: credential, user: { id: userId } } }, error: null })
  auth.mockResolvedValue({ rpc, auth: { getUser, getSession } })
  fetchMock.mockResolvedValue(Response.json({ items: [] }))
})

afterAll(() => {
  global.fetch = previousFetch
  if (previousUrl === undefined) delete process.env.API_SERVER_URL
  else process.env.API_SERVER_URL = previousUrl
})

it("validates route, site and unknown fields before any remote access", async () => {
  expect((await proxyConnector(request("catalog"), ["catalog"])).status).toBe(400)
  expect((await proxyConnector(request("proxy"), ["proxy"])).status).toBe(404)
  expect((await proxyConnector(request(`catalog?site_id=${siteId}&user_id=${userId}`), ["catalog"])).status).toBe(400)
  expect(fetchMock).not.toHaveBeenCalled()
})

it("validates and forwards only workspace-scoped domain counts", async () => {
  const path = ["domain-counts"]
  const get = (extra = "") => proxyConnector(request(`domain-counts?site_id=${siteId}&tab=connected${extra}`), path)
  expect((await get("&category=support")).status).toBe(400)
  rpc.mockResolvedValueOnce({ data: [{ can_view: false, can_manage: false }], error: null })
  expect((await get()).status).toBe(403)
  expect(fetchMock).not.toHaveBeenCalled()
  rpc.mockResolvedValueOnce({ data: [{ can_view: true, can_manage: false }], error: null })
  const counts = { total: 3, counts: { support: 2, storage: 0 } }
  fetchMock.mockResolvedValueOnce(Response.json({ ...counts, provider_metadata: credential }))
  const response = await get("&q=mail")
  expect(await response.json()).toEqual(counts)
  expect(response.headers.get("cache-control")).toBe("private, no-store")
  expect(fetchMock.mock.calls[0][0].pathname).toBe("/api/connectors/domain-counts")
  expect(fetchMock.mock.calls[0][0].searchParams.get("q")).toBe("mail")
  fetchMock.mockResolvedValueOnce(Response.json({ total: 3, counts: { support: -1 } }))
  expect((await get()).status).toBe(502)
})

it('reads only the requested account summary, removes private fields and rejects a substituted ID', async () => {
  const path = ['connections', attemptId]
  const get = (extra = '') => proxyConnector(request(`${path.join('/')}?site_id=${siteId}${extra}`), path)
  const dto = { id: attemptId, toolkit_slug: 'supabase', display_name: 'Reporting', provider_status: 'ACTIVE',
    enabled: true, revocation_pending: false, revision: 1, verified_at: null, can_use: true }
  expect((await get('&q=search')).status).toBe(400)
  rpc.mockResolvedValueOnce({ data: [{ can_view: true, can_manage: false }], error: null })
  fetchMock.mockResolvedValueOnce(Response.json({ ...dto, provider_account_id: credential }))
  expect(await (await get()).json()).toEqual(dto)
  expect(fetchMock.mock.calls[0][0].pathname).toBe(`/api/connectors/connections/${attemptId}`)
  fetchMock.mockResolvedValueOnce(Response.json({ ...dto, id: userId }))
  expect((await get()).status).toBe(502)
})

it("binds only on a same-origin manager request and projects an exact ID/revision receipt", async () => {
  const path = ["connections", attemptId, "bind-project"]
  const input = { site_id: siteId, expected_revision: 3, project_ref: "a".repeat(20) }
  const submit = (body: unknown, headers?: Record<string, string>) => proxyConnector(request(path.join("/"), "POST", body, headers), path)
  expect((await submit(input, { origin: "https://foreign.example.test" })).status).toBe(403)
  expect((await submit({ ...input, actor_id: userId })).status).toBe(400)
  rpc.mockResolvedValueOnce({ data: [{ can_view: true, can_manage: false }], error: null })
  expect((await submit(input)).status).toBe(403)
  expect(fetchMock).not.toHaveBeenCalled()
  fetchMock.mockResolvedValueOnce(Response.json({ connector_id: attemptId, revision: 4, provider_metadata: credential }))
  expect(await (await submit(input)).json()).toEqual({ connector_id: attemptId, revision: 4 })
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(input)
  fetchMock.mockResolvedValueOnce(Response.json({ connector_id: userId, revision: 4 }))
  expect((await submit(input)).status).toBe(502)
})

it("protects the approval inbox and never forwards caller-selected execution arguments", async () => {
  const inbox = request(`approvals?site_id=${siteId}`)
  rpc.mockResolvedValueOnce({ data: [{ can_view: true, can_manage: false }], error: null })
  expect((await proxyConnector(inbox, ["approvals"])).status).toBe(403)
  const path = ["approvals", attemptId, "approve"]
  const submit = (body: unknown) => proxyConnector(request(path.join("/"), "POST", body), path)
  expect((await submit({ site_id: siteId, arguments: {}, actor: userId })).status).toBe(400)
  expect(fetchMock).not.toHaveBeenCalled()
  fetchMock.mockResolvedValueOnce(Response.json({ id: attemptId, status: "completed" }))
  expect((await submit({ site_id: siteId })).status).toBe(200)
  expect(fetchMock.mock.calls[0][0].pathname).toBe(`/api/connectors/approvals/${attemptId}/approve`)
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ site_id: siteId })
})

describe("provider-direct manager opt-in", () => {
  const path = ["connections", attemptId, "provider-direct"]
  const url = path.join("/")
  const input = { site_id: siteId, expected_revision: 3, expected_direct_revision: 6, enabled: true }
  const dto = { connector_id: attemptId, revision: 3, direct_revision: 7, attested: true, enabled: true }
  const get = (suffix = "") => proxyConnector(request(`${url}?site_id=${siteId}${suffix}`), path)
  const patch = (body: unknown = input, suffix = "", headers?: Record<string, string>) => proxyConnector(request(url + suffix, "PATCH", body, headers), path)

  it("protects both reads and writes with verified site manager access, including the original session and origin", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } }); expect((await get()).status).toBe(401)
    for (const send of [get, patch]) {
      rpc.mockResolvedValueOnce({ data: [{ can_view: true, can_manage: false }] }); expect((await send()).status).toBe(403)
      rpc.mockResolvedValueOnce({ data: [] }); expect((await send()).status).toBe(403)
    }
    getSession.mockResolvedValueOnce({ data: { session: { user: { id: siteId }, access_token: credential } } })
    expect((await patch()).status).toBe(401)
    expect((await patch(input, "", { origin: "https://other.example.test" })).status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("accepts only site scope on GET and an explicit revision-bound boolean on PATCH", async () => {
    for (const query of ["&q=other", `&site_id=${userId}`, "&attested=true"]) expect((await get(query)).status).toBe(400)
    expect((await patch(input, `?site_id=${userId}`)).status).toBe(400)
    for (const extra of [{ attested: true }, { allowed_tools: [] }, { catalog_reads: true }, { actor_id: userId },
      { expected_revision: 0 }, { expected_revision: 2_147_483_647 }, { expected_direct_revision: undefined },
      { expected_direct_revision: 2_147_483_647 }, { enabled: 1 }, { enabled: undefined }]) {
      expect((await patch({ ...input, ...extra })).status).toBe(400)
    }
    expect((await proxyConnector(request(url, "POST", input), path)).status).toBe(404)
    expect((await proxyConnector(request(url), ["connections", "other", "provider-direct"])).status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns only the bound policy DTO and forwards only the actor bearer", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ...dto, attestation_id: userId, evidence_ref: credential }))
    const response = await get()
    expect(await response.json()).toEqual(dto)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(rpc).toHaveBeenCalledWith("connector_site_access", { p_site_id: siteId, p_user_id: userId })
    const [target, init] = fetchMock.mock.calls[0]
    expect(target.href).toBe(`https://api.example.test/api/connectors/${url}?site_id=${siteId}`)
    expect(init.headers.authorization).toBe(`Bearer ${credential}`)
    for (const enabled of [true, false]) {
      const change = { ...input, enabled }; const receipt = { ...dto, enabled, attested: enabled }
      fetchMock.mockResolvedValueOnce(Response.json({ ...receipt, provider_project_id: credential }))
      expect(await (await patch(change)).json()).toEqual(receipt)
      expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body)).toEqual(change)
    }
  })

  it("rejects a substituted account, wrong revision, wrong state, inconsistent proof or ambiguous success", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ...dto, connector_id: userId }))
    expect((await get()).status).toBe(502)
    for (const reply of [{ ...dto, revision: 4 }, { ...dto, direct_revision: 6 }, { ...dto, enabled: false }, { ...dto, attested: false },
      { ...dto, connector_id: userId }, { ...dto, enabled: "true" }, {}]) {
      fetchMock.mockResolvedValueOnce(Response.json(reply))
      expect((await (await patch()).json()).error.code).toBe("OUTCOME_UNKNOWN")
    }
    fetchMock.mockResolvedValueOnce(new Response("Not JSON"))
    expect((await (await patch()).json()).error.code).toBe("OUTCOME_UNKNOWN")
    expect(fetchMock).toHaveBeenCalledTimes(9)
  })

  it.each(["DIRECT_ATTESTATION_REQUIRED", "REVISION_CONFLICT", "PRIVATE_DETAIL_FROM_UPSTREAM"])("returns safe status for %s, never raw upstream errors", async code => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code, message: credential } }, { status: 409 }))
    const response = await patch()
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: { code: code.startsWith("PRIVATE") ? "REQUEST_FAILED" : code, message: "Connector request could not be confirmed." } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

it("projects bounded thread context fields without passing raw source messages or provider data to the client", async () => {
  const item = { id: attemptId, connector_id: attemptId, agent_id: userId, conversation_id: attemptId,
    review_conversation_id: attemptId, account_label: "Support", tool_slug: "GMAIL_FETCH_EMAILS", version: "1", arguments: {},
    expires_at: "2026-11-21T12:00:00Z", created_at: "2026-11-20T12:00:00Z",
    context: { agent_label: "Support agent", conversation_title: "Delivery question", instance_id: null,
      instance_label: null, source_excerpt: "Has my order shipped?" } }
  fetchMock.mockResolvedValueOnce(Response.json({ items: [{ ...item, result: credential,
    context: { ...item.context, raw_message: credential } }] }))
  const response = await proxyConnector(request(`approvals?site_id=${siteId}`), ["approvals"])
  expect(await response.json()).toEqual({ items: [item] })
  expect(response.headers.get('cache-control')).toContain('no-store')
})

it("requires manager access and forwards only workspace and toolkit for OAuth setup", async () => {
  const path = ["managed-oauth"]
  const input = { site_id: siteId, toolkit_slug: "googlecalendar" }
  const makeRequest = (body: unknown) => request(path[0], "POST", body)
  expect((await proxyConnector(makeRequest({ ...input, scopes: ["unreviewed"] }), path)).status).toBe(400)
  rpc.mockResolvedValueOnce({ data: [{ can_view: true, can_manage: false }], error: null })
  expect((await proxyConnector(makeRequest(input), path)).status).toBe(403)
  expect(fetchMock).not.toHaveBeenCalled()
  fetchMock.mockResolvedValueOnce(Response.json({ status: "available" }))
  const response = await proxyConnector(makeRequest(input), path)
  expect(await response.json()).toEqual({ status: "available" })
  expect(response.headers.has("set-cookie")).toBe(false)
  expect(fetchMock).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/api/connectors/managed-oauth" }), expect.objectContaining({ body: JSON.stringify(input) }))
})

it("forwards tool searches and exact catalogue policy IDs without granting execution", async () => {
  const tools = ["catalog", "supabase", "tools"]
  const response = await proxyConnector(request(`${tools.join("/")}?site_id=${siteId}&page=2&q=list+tables&action=read`), tools)
  expect(response.status).toBe(200)
  const url: URL = fetchMock.mock.calls[0][0]
  expect(url.pathname).toBe("/api/connectors/catalog/supabase/tools")
  expect(Object.fromEntries(url.searchParams)).toEqual({ site_id: siteId, page: "2", q: "list tables", action: "read" })
  expect((await proxyConnector(request(`${tools.join("/")}?site_id=${siteId}&action=readOnlyHint`), tools)).status).toBe(400)
  expect((await proxyConnector(request(`catalog?site_id=${siteId}&action=read`), ["catalog"])).status).toBe(400)

  const path = ["connections", attemptId, "policy"]
  const update = { site_id: siteId, expected_revision: 1, allowed_tools: ["SUPABASE_LIST_TABLES", "A".repeat(150)], allowed_hosts: ["assistant"], require_approval: false, enabled: false }
  fetchMock.mockResolvedValueOnce(Response.json({ revision: 2 }))
  expect((await proxyConnector(request(path.join("/"), "PATCH", update), path)).status).toBe(200)
  expect(fetchMock.mock.calls[1][0].pathname).toBe(`/api/connectors/connections/${attemptId}/policy`)
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(update)
  expect((await proxyConnector(request(path.join("/"), "PATCH", { ...update, allowed_tools: ["SUPABASE_*"] }), path)).status).toBe(400)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it.each(["all", "selected"])("forwards an explicit %s tool mode with an empty ID list", async mode => {
  const path = ["connections", attemptId, "policy"]
  const update = { site_id: siteId, expected_revision: 1, tool_access_mode: mode, allowed_tools: [], allowed_hosts: ["assistant"], require_approval: true, enabled: true }
  const submit = (body: unknown) => proxyConnector(request(path.join("/"), "PATCH", body), path)
  expect((await submit({ ...update, tool_access_mode: "*" })).status).toBe(400)
  expect(fetchMock).not.toHaveBeenCalled()
  expect((await submit(update)).status).toBe(200)
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(update)
})

it("forwards only explicit boolean catalogue consent and rejects non-booleans before forwarding", async () => {
  const path = ["connections", attemptId, "policy"]
  const update = { site_id: siteId, expected_revision: 1, tool_access_mode: "selected", allowed_tools: ["MAIL_LIST"], allowed_hosts: ["assistant"], require_approval: false, enabled: true }
  const submit = (catalog_reads: unknown) => proxyConnector(request(path.join("/"), "PATCH", { ...update, catalog_reads }), path)
  for (const value of [null, 1, "false"]) expect((await submit(value)).status).toBe(400)
  expect(fetchMock).not.toHaveBeenCalled()
  for (const value of [false, true]) {
    fetchMock.mockResolvedValueOnce(Response.json({ revision: 2 }))
    expect((await submit(value)).status).toBe(200)
    expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body)).toEqual({ ...update, catalog_reads: value })
  }
})

it("accepts a standalone opt-out, never an abbreviated opt-in or a mixed partial policy", async () => {
  const path = ["connections", attemptId, "policy"], base = { site_id: siteId, expected_revision: 1 }
  const submit = (body: unknown) => proxyConnector(request(path.join("/"), "PATCH", body), path)
  for (const bad of [{ catalog_reads:true }, {catalog_reads:false, enabled:true}, {catalog_reads:false, allowed_tools:["NEW"]}]) {
    expect((await submit({...base, ...bad})).status).toBe(400)
  }
  expect(fetchMock).not.toHaveBeenCalled()
  expect((await submit({...base, catalog_reads:false})).status).toBe(200)
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({...base, catalog_reads:false})
})

it("never reflects token fields or provider error messages from token setup", async () => {
  const path = ["supabase-token"]
  const token = `sbp_${randomBytes(24).toString("hex")}`
  const input = { site_id: siteId, project_ref: "a".repeat(20), token }
  const submit = () => proxyConnector(request(path[0], "POST", input), path)
  fetchMock.mockResolvedValueOnce(Response.json({ status: "completed", connector_id: attemptId, token }))
  expect(await (await submit()).json()).toEqual({ status: "completed", connector_id: attemptId })
  fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "SUPABASE_TOKEN_REJECTED", message: token } }, { status: 422 }))
  const rejected = await submit()
  expect(rejected.status).toBe(422)
  expect(await rejected.text()).not.toContain(token)
})

it("forwards toolkit tool pages through the actor-scoped read boundary", async () => {
  const response = await proxyConnector(request(`catalog/gmail/tools?site_id=${siteId}&cursor=next`), ["catalog", "gmail", "tools"])
  expect(response.status).toBe(200)
  const [url, init] = fetchMock.mock.calls[0]
  expect(url.pathname).toBe("/api/connectors/catalog/gmail/tools")
  expect(url.searchParams.get("cursor")).toBe("next")
  expect(init.headers.authorization).toBe(`Bearer ${credential}`)
  expect((await proxyConnector(request(`catalog/gmail/execute?site_id=${siteId}`), ["catalog", "gmail", "execute"])).status).toBe(404)
})

it("denies cross-origin mutations and missing use/view invariant", async () => {
  expect((await proxyConnector(request(`connections/${attemptId}/sync`, "POST", { site_id: siteId, expected_revision: 1 }, { origin: "https://evil.example.test" }), ["connections", attemptId, "sync"])).status).toBe(403)
  expect((await proxyConnector(request(`connections/${attemptId}/access`, "PATCH", {
    site_id: siteId, expected_revision: 0, members: [{ user_id: userId, can_view: false, can_use: true }], agents: [],
  }), ["connections", attemptId, "access"])).status).toBe(400)
  expect(fetchMock).not.toHaveBeenCalled()
})

it("fails closed on screen denial and permission outage", async () => {
  rpc.mockResolvedValueOnce({ data: [{ can_view: false }], error: null })
  expect((await proxyConnector(request(`catalog?site_id=${siteId}`), ["catalog"])).status).toBe(403)
  rpc.mockResolvedValueOnce({ data: null, error: { code: "offline" } })
  expect((await proxyConnector(request(`catalog?site_id=${siteId}`), ["catalog"])).status).toBe(503)
  expect(fetchMock).not.toHaveBeenCalled()
})

it("forwards only the authenticated actor credential and scoped query", async () => {
  const result = await proxyConnector(request(`catalog?site_id=${siteId}&q=calendar`), ["catalog"])
  expect(result.status).toBe(200)
  expect(auth).toHaveBeenCalledWith(true)
  expect(getUser).toHaveBeenCalledTimes(1)
  expect(rpc).toHaveBeenCalledWith("connector_site_access", { p_site_id: siteId, p_user_id: userId })
  const [url, init] = fetchMock.mock.calls[0]
  expect(url.origin).toBe("https://api.example.test")
  expect(init.headers.authorization).toBe(`Bearer ${credential}`)
  expect(init.headers["x-api-key"]).toBeUndefined()
  expect(init.redirect).toBe("error")
  expect(await result.text()).not.toContain(credential)
})

it("keeps an actor/site-bound OAuth nonce in an HttpOnly attempt cookie", async () => {
  fetchMock.mockResolvedValue(Response.json({ attempt_id: attemptId, redirect_url: "https://connect.composio.dev/link" }))
  const response = await proxyConnector(request("auth-attempts", "POST", { site_id: siteId, toolkit_slug: "gmail", auth_config_id: "ac_test" }), ["auth-attempts"])
  const cookie = response.headers.get("set-cookie")!
  expect(cookie).toContain("HttpOnly")
  expect(cookie).toContain("SameSite=lax")
  const body = JSON.parse(fetchMock.mock.calls[0][1].body)
  expect(body.nonce).toMatch(/^[a-f0-9]{64}$/)
  expect(await response.text()).not.toContain(body.nonce)
  const parsed = readAttemptCookie(request("pending-auth", "GET", undefined, { cookie: cookie.split(";")[0] }), attemptId)
  expect(parsed).toEqual({ nonce: body.nonce, site_id: siteId, user_id: userId })
})

it("requires the original actor's attempt cookie and rejects forged completion fields", async () => {
  const path = ["auth-attempts", attemptId, "complete"]
  expect((await proxyConnector(request(path.join("/"), "POST", { session_uri: "opaque" }), path)).status).toBe(403)
  const response = NextResponse.json({})
  setAttemptCookie(response, attemptId, { site_id: siteId, user_id: siteId, nonce: randomBytes(32).toString("hex") })
  expect((await proxyConnector(request(path.join("/"), "POST", { session_uri: "opaque" }, {
    cookie: response.headers.get("set-cookie")!.split(";")[0],
  }), path)).status).toBe(403)
  expect((await proxyConnector(request(path.join("/"), "POST", { session_uri: "opaque", site_id: siteId }), path)).status).toBe(400)
  expect(fetchMock).not.toHaveBeenCalled()
})

it("does not retry a mutation after an ambiguous network failure", async () => {
  fetchMock.mockRejectedValue(new Error("connection interrupted"))
  const response = await proxyConnector(request(`connections/${attemptId}/sync`, "POST", { site_id: siteId, expected_revision: 1 }), ["connections", attemptId, "sync"])
  expect(response.status).toBe(502)
  expect((await response.json()).error.code).toBe("OUTCOME_UNKNOWN")
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it("accepts RPC-authorized coowners without a legacy membership role", async () => {
  const response = await proxyConnector(request(`connections/${attemptId}/sync`, "POST", { site_id: siteId, expected_revision: 1 }), ["connections", attemptId, "sync"])
  expect(response.status).toBe(200)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it("denies location/screen/license RPC denial and manager-only attempt reads", async () => {
  rpc.mockResolvedValueOnce({ data: [{ can_view: false, can_manage: false }], error: null })
  expect((await proxyConnector(request(`catalog?site_id=${siteId}`), ["catalog"])).status).toBe(403)
  rpc.mockResolvedValueOnce({ data: [{ can_view: true, can_manage: false }], error: null })
  expect((await proxyConnector(request(`auth-attempts/${attemptId}?site_id=${siteId}`), ["auth-attempts", attemptId])).status).toBe(403)
  expect(fetchMock).not.toHaveBeenCalled()
})

it("requires verified identity and the same user's session", async () => {
  getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
  expect((await proxyConnector(request(`catalog?site_id=${siteId}`), ["catalog"])).status).toBe(401)
  expect(rpc).not.toHaveBeenCalled()
  getSession.mockResolvedValueOnce({ data: { session: { user: { id: siteId }, access_token: credential } }, error: null })
  expect((await proxyConnector(request(`catalog?site_id=${siteId}`), ["catalog"])).status).toBe(401)
  expect(fetchMock).not.toHaveBeenCalled()
})

it("clears only the completed attempt cookie with its original path", async () => {
  const cookieResponse = NextResponse.json({})
  setAttemptCookie(cookieResponse, attemptId, { site_id: siteId, user_id: userId, nonce: randomBytes(32).toString("hex") })
  fetchMock.mockResolvedValueOnce(Response.json({ status: "completed", connector_id: attemptId, toolkit_slug: "mail" }))
  const path = ["auth-attempts", attemptId, "complete"]
  const response = await proxyConnector(request(path.join("/"), "POST", { session_uri: "proof" }, { cookie: cookieResponse.headers.get("set-cookie")!.split(";")[0] }), path)
  expect(response.status).toBe(200)
  expect(response.headers.get("set-cookie")).toContain(`mf_connector_${attemptId}=`)
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0")
  expect(response.headers.get("set-cookie")).toContain("Path=/api/connectors")
})