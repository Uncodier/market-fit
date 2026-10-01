/** @jest-environment node */

import { getContentDeletionPreview } from "@/app/content/get-content-deletion-preview"
import { OUTSTAND_RESPONSE_LIMIT, OUTSTAND_TIMEOUT_MS } from "@/app/content/outstand-http"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))

const contentId = "00000000-0000-4000-8000-000000000001"
const siteId = "00000000-0000-4000-8000-000000000002"
const otherSite = "00000000-0000-4000-8000-000000000003"
const userId = "user-one"
const publishedAt = "2026-09-30T12:00:00Z"
const privateDetail = "fixture-private-provider-detail"
const userToken = "fixture-user-token"
const serviceKey = "fixture-never-forward-service-key"
const environment = { ...process.env }
const getUser = jest.fn()
const getSession = jest.fn()
const rpc = jest.fn()
const load = jest.fn()
const readEq = jest.fn(() => ({ maybeSingle: load }))
const readSelect = jest.fn(() => ({ eq: readEq }))
const mutations = { delete: jest.fn(), update: jest.fn(), insert: jest.fn(), upsert: jest.fn() }
const from = jest.fn(() => ({ select: readSelect, ...mutations }))
const record = (tags: string[] | null = ["outstand_id_post-one"]) => ({ id: contentId, site_id: siteId, tags })
// Match the API's publicPost DTO, adding sentinel extras to exercise stripping.
const account = (overrides: Record<string, unknown> = {}) => ({
  id: "account-one", network: "x", username: "team", status: "published",
  platformPostId: "platform-one", publishedAt, nickname: "Private nickname",
  platformPostUrl: "https://social.example.test/private-post", error: null,
  accessToken: privateDetail, ...overrides,
})
const post = (id = "post-one", overrides: Record<string, unknown> = {}) => ({
  id, publishedAt, scheduledAt: null, isDraft: false, socialAccounts: [account()],
  createdAt: publishedAt, containers: [{ content: "Private post text", media: [] }],
  providerCredentials: privateDetail, ...overrides,
})
const snapshot = (id = "post-one", overrides: Record<string, unknown> = {}) => ({ success: true, post: post(id, overrides) })
const invoke = () => getContentDeletionPreview(contentId)
const requestedIds = () => jest.mocked(fetch).mock.calls.map(([url]) => new URL(String(url)).pathname.split("/").pop())
const linked = (count: number) => Array.from({ length: count }, (_, index) => `outstand_id_post-${index}`)
const successfulFetch = async (url: Parameters<typeof fetch>[0]) => Response.json(snapshot(new URL(String(url)).pathname.split("/").pop()))

function expectFailure(result: unknown, status: number) {
  expect(result).toEqual({ success: false, status, error: expect.any(String) })
  expect(result).not.toHaveProperty("data")
  for (const secret of [privateDetail, userToken, serviceKey]) expect(JSON.stringify(result)).not.toContain(secret)
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = "https://api.example.test"
  process.env.SERVICE_API_KEY = serviceKey
  getUser.mockReset().mockResolvedValue({ data: { user: { id: userId } }, error: null })
  getSession.mockReset().mockResolvedValue({ data: { session: { user: { id: userId }, access_token: userToken } }, error: null })
  rpc.mockReset().mockImplementation(async (name: string) => ({ data: name === "current_user_site_role" ? "owner" : true, error: null }))
  load.mockReset().mockResolvedValue({ data: record(), error: null })
  jest.mocked(createClient).mockReset().mockResolvedValue({ auth: { getUser, getSession }, rpc, from })
  jest.mocked(fetch).mockReset().mockImplementation(successfulFetch)
  for (const method of ["error", "warn", "log"] as const) jest.spyOn(console, method).mockImplementation(() => {})
})

afterEach(() => {
  for (const mutation of Object.values(mutations)) expect(mutation).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
  expect(revalidatePath).not.toHaveBeenCalled()
  for (const [, options] of jest.mocked(fetch).mock.calls) {
    expect(options?.method).toBe("GET")
    expect(options).not.toHaveProperty("body")
  }
  expect(JSON.stringify(jest.mocked(fetch).mock.calls)).not.toContain(serviceKey)
  for (const method of ["error", "warn", "log"] as const) {
    for (const secret of [privateDetail, userToken, serviceKey]) expect(JSON.stringify(jest.mocked(console[method]).mock.calls)).not.toContain(secret)
  }
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
})
afterAll(() => { process.env = environment })

it("returns only the minimal preview from a real GET snapshot after delete and select authorization", async () => {
  expect(await invoke()).toEqual({ success: true, data: {
    linkedPostCount: 1, accounts: [{ network: "x", label: "X", username: "team", disposition: "remote" }], canDeleteRemotely: true,
  } })
  expect(jest.mocked(createClient).mock.calls).toEqual([[true], [true]])
  expect(from).toHaveBeenCalledWith("content")
  expect(readSelect).toHaveBeenCalledWith("id, site_id, tags")
  expect(readEq).toHaveBeenCalledWith("id", contentId)
  expect(rpc.mock.calls).toEqual([
    ["user_can", { p_site_id: siteId, p_command: "delete" }],
    ["current_user_site_role", { p_site_id: siteId }],
    ["user_can", { p_site_id: siteId, p_command: "select" }],
  ])
  expect(getUser).toHaveBeenCalledTimes(2)
  expect(getSession).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith(new URL(`https://api.example.test/api/integrations/outstand/posts/post-one?tenant_id=${siteId}`), {
    method: "GET", cache: "no-store", redirect: "error", signal: expect.any(AbortSignal),
    headers: { Authorization: `Bearer ${userToken}`, Accept: "application/json" },
  })
})

it("retains all account summaries and disallows remote deletion for mixed supported/manual networks", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(snapshot("post-one", { socialAccounts: [
    account(), account({ id: "account-two", network: "instagram", username: "photos" }),
    account({ id: "account-three", network: "tiktok", username: "videos" }),
  ] })))
  expect(await invoke()).toEqual({ success: true, data: { linkedPostCount: 1, canDeleteRemotely: false, accounts: [
    { network: "x", label: "X", username: "team", disposition: "remote" },
    { network: "instagram", label: "Instagram", username: "photos", disposition: "manual" },
    { network: "tiktok", label: "TikTok", username: "videos", disposition: "manual" },
  ] } })
})

it("reads only exact distinct persisted IDs, preserving case and ignoring publication tags/text", async () => {
  load.mockResolvedValue({ data: { ...record(["outstand_id_Post_A-1", "published_x", "outstand_id_post-two", "outstand_id_Post_A-1"]),
    title: "post-guessed", text: "outstand_id_foreign", socialAccounts: ["foreign"] }, error: null })
  expect(await invoke()).toMatchObject({ success: true, data: { linkedPostCount: 2 } })
  expect(requestedIds()).toEqual(["Post_A-1", "post-two"])
  for (const [url] of jest.mocked(fetch).mock.calls) expect(new URL(String(url)).search).toBe(`?tenant_id=${siteId}`)
})

it.each([null, [], ["published_x"], ["published_instagram", "outstand", "post-one"]])("never performs GET or guesses links from %j", async tags => {
  load.mockResolvedValue({ data: record(tags), error: null })
  expect(await invoke()).toEqual({ success: true, data: { linkedPostCount: 0, accounts: [], canDeleteRemotely: false } })
  expect(rpc).toHaveBeenCalledWith("user_can", { p_site_id: siteId, p_command: "delete" })
  expect(fetch).not.toHaveBeenCalled()
  expect(getSession).not.toHaveBeenCalled()
})

it.each(["../bad", "outstand-post-one", "", "demo-site", null, undefined, 123])("rejects invalid content IDs: %j", async id => {
  expectFailure(await getContentDeletionPreview(id as string), 400)
  expect(createClient).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it.each([null, { message: privateDetail }])("requires verified identity before loading content (%j)", async error => {
  getUser.mockResolvedValue({ data: { user: error ? { id: userId } : null }, error })
  expectFailure(await invoke(), 401)
  expect(from).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it("rechecks identity at the provider read boundary", async () => {
  getUser.mockResolvedValueOnce({ data: { user: { id: userId } }, error: null }).mockResolvedValueOnce({ data: { user: null }, error: null })
  expectFailure(await invoke(), 401)
  expect(getSession).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  [null, null, 404], [null, { message: privateDetail }, 503],
  [{ ...record(), id: otherSite }, null, 502], [{ ...record(), site_id: "demo-site" }, null, 502],
  [{ ...record(), tags: [123] }, null, 502],
])("rejects RLS-hidden, mismatched or invalid persisted content (%#)", async (data, error, status) => {
  load.mockResolvedValue({ data, error })
  expectFailure(await invoke(), status as number)
  expect(fetch).not.toHaveBeenCalled()
})

it("authorizes the persisted foreign site rather than trusting the content ID or guessed tenant", async () => {
  load.mockResolvedValue({ data: { ...record(), site_id: otherSite }, error: null })
  rpc.mockImplementation(async (_name, args) => ({ data: args.p_site_id === siteId, error: null }))
  expectFailure(await invoke(), 403)
  expect(rpc).toHaveBeenCalledWith("user_can", { p_site_id: otherSite, p_command: "delete" })
  expect(fetch).not.toHaveBeenCalled()
})

describe.each(["delete", "select"])("%s capability", command => {
  it.each([false, null, "true", "rpc-error"])("fails closed on %j", async capability => {
    rpc.mockImplementation(async (name, args) => name === "user_can" && args.p_command === command
      ? { data: capability === "rpc-error" ? true : capability, error: capability === "rpc-error" ? { message: privateDetail } : null }
      : { data: name === "current_user_site_role" ? "owner" : true, error: null })
    expectFailure(await invoke(), 403)
    expect(getSession).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})

it.each([null, "outsider", "viewer", "rpc-error"])("rejects invalid site membership: %j", async role => {
  rpc.mockImplementation(async name => ({ data: name === "current_user_site_role" ? role : true,
    error: name === "current_user_site_role" && role === "rpc-error" ? { message: privateDetail } : null }))
  expectFailure(await invoke(), 403)
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  null, { user: { id: "other-user" }, access_token: userToken }, { user: { id: userId } },
  ...["", "bad token", "line\nbreak", "x".repeat(8193), 123].map(access_token => ({ user: { id: userId }, access_token })),
])("rejects absent, mismatched or malformed sessions (%#)", async session => {
  getSession.mockResolvedValue({ data: { session }, error: null })
  expectFailure(await invoke(), 401)
  expect(fetch).not.toHaveBeenCalled()
})

it("fails closed on session errors despite an otherwise valid token", async () => {
  getSession.mockResolvedValue({ data: { session: { user: { id: userId }, access_token: userToken } }, error: { message: privateDetail } })
  expectFailure(await invoke(), 401)
  expect(fetch).not.toHaveBeenCalled()
})

it.each(["", "../foreign", "post?tenant_id=other", "post#fragment", "%2e%2e", "post/foreign", "post\\foreign", " post", "post\n", "x".repeat(201)])(
  "rejects unsafe persisted IDs before making any request (%#)", async id => {
    load.mockResolvedValue({ data: record(["outstand_id_valid", `outstand_id_${id}`]), error: null })
    expectFailure(await invoke(), 400)
    expect(fetch).not.toHaveBeenCalled()
  },
)

it("rejects more than 100 distinct links without truncating them", async () => {
  load.mockResolvedValue({ data: record(linked(101)), error: null })
  expectFailure(await invoke(), 400)
  expect(fetch).not.toHaveBeenCalled()
})

it("checks all 100 distinct links, not a 50-post list or raw duplicate count", async () => {
  load.mockResolvedValue({ data: record([...linked(100), ...linked(100)]), error: null })
  const result = await invoke()
  expect(result).toMatchObject({ success: true, data: { linkedPostCount: 100, canDeleteRemotely: true } })
  if (result.success) expect(result.data.accounts).toHaveLength(100)
  expect(requestedIds()).toEqual(linked(100).map(tag => tag.slice("outstand_id_".length)))
})

describe.each(["envelope", "post", "account"])("%s site metadata", level => {
  it.each(["tenant_id", "tenantId", "site_id", "siteId"])("rejects foreign %s before stripping extra properties", async key => {
    const body = snapshot()
    const target = level === "envelope" ? body : level === "post" ? body.post : body.post.socialAccounts[0]
    Object.assign(target, { [key]: otherSite })
    jest.mocked(fetch).mockResolvedValueOnce(Response.json(body))
    expectFailure(await invoke(), 502)
  })
})

it.each([null, 123, { id: siteId }])("rejects invalid account site metadata: %j", async tenantId => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(snapshot("post-one", { socialAccounts: [account({ tenantId })] })))
  expectFailure(await invoke(), 502)
})

it.each([
  null, {}, { success: false }, { success: "true", post: post() }, { success: true },
  { success: true, posts: [post()] }, { ...snapshot(), error: privateDetail }, { ...snapshot(), degraded: true },
  snapshot("other-post"), snapshot("post-one", { socialAccounts: [] }), snapshot("post-one", { socialAccounts: {} }),
  snapshot("post-one", { socialAccounts: [account(), account()] }),
  snapshot("post-one", { socialAccounts: [account({ id: "../foreign" })] }),
  snapshot("post-one", { socialAccounts: [account({ id: undefined })] }),
  snapshot("post-one", { socialAccounts: [account({ network: "" })] }),
  snapshot("post-one", { socialAccounts: [account({ username: 123 })] }),
  snapshot("post-one", { socialAccounts: [account({ status: undefined })] }),
  snapshot("post-one", { socialAccounts: [account({ platformPostId: undefined })] }),
  snapshot("post-one", { socialAccounts: [account({ publishedAt: undefined })] }),
  snapshot("post-one", { publishedAt: undefined }), snapshot("post-one", { scheduledAt: undefined }),
  snapshot("post-one", { isDraft: "false" }),
])("never turns invalid or ambiguous snapshots into an empty successful preview (%#)", async body => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(body))
  expectFailure(await invoke(), 502)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it("does not publish partial preview data when the final linked post is unavailable", async () => {
  load.mockResolvedValue({ data: record(linked(6)), error: null })
  jest.mocked(fetch).mockImplementation(async url => String(url).includes("/post-5?")
    ? Response.json({ success: false, error: privateDetail }, { status: 404 }) : successfulFetch(url))
  expectFailure(await invoke(), 404)
  expect(requestedIds()).toEqual(linked(6).map(tag => tag.slice("outstand_id_".length)))
})

it.each([400, 401, 403, 404, 409, 422, 429, 500, 503])("keeps HTTP %i failures distinct from empty successful data", async status => {
  const response = Response.json({ success: true, post: post(), error: privateDetail }, { status })
  const cancel = jest.spyOn(response.body!, "cancel")
  jest.mocked(fetch).mockResolvedValueOnce(response)
  expectFailure(await invoke(), status === 500 ? 502 : status)
  expect(cancel).toHaveBeenCalled()
  expect(fetch).toHaveBeenCalledTimes(1)
})

it.each([
  ["invalid JSON", () => new Response(`{${privateDetail}`, { headers: { "content-type": "application/json" } })],
  ["HTML", () => new Response(privateDetail, { headers: { "content-type": "text/html" } })],
  ["empty body", () => new Response(null, { headers: { "content-type": "application/json" } })],
  ["redirect", () => new Response(null, { status: 302, headers: { Location: `https://other.example.test/${privateDetail}` } })],
  ["declared oversized body", () => Response.json(snapshot(), { headers: { "content-length": String(OUTSTAND_RESPONSE_LIMIT + 1) } })],
] as const)("fails closed on %s without retries", async (_name, response) => {
  jest.mocked(fetch).mockResolvedValueOnce(response())
  expectFailure(await invoke(), 502)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(jest.mocked(fetch).mock.calls[0][1]?.redirect).toBe("error")
})

it("enforces a streaming byte limit even with a dishonest Content-Length and cancels the stream", async () => {
  const cancel = jest.fn()
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(OUTSTAND_RESPONSE_LIMIT + 1)) }, cancel,
  })
  jest.mocked(fetch).mockResolvedValueOnce(new Response(stream, { headers: { "content-type": "application/json", "content-length": "1" } }))
  expectFailure(await invoke(), 502)
  expect(cancel).toHaveBeenCalled()
  expect(fetch).toHaveBeenCalledTimes(1)
})

it("does not leak network or body-read exceptions or retry the request", async () => {
  jest.mocked(fetch).mockRejectedValueOnce(new Error(privateDetail))
  expectFailure(await invoke(), 502)
  const stream = new ReadableStream({ start(controller) { controller.error(new Error(privateDetail)) } })
  jest.mocked(fetch).mockResolvedValueOnce(new Response(stream, { headers: { "content-type": "application/json" } }))
  expectFailure(await invoke(), 502)
  expect(fetch).toHaveBeenCalledTimes(2)
})

it.each(["headers", "body"])("times out stalled %s within OUTSTAND_TIMEOUT_MS and aborts without retries", async phase => {
  jest.useFakeTimers()
  const cancel = jest.fn()
  if (phase === "headers") jest.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}))
  else jest.mocked(fetch).mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { headers: { "content-type": "application/json" } }))
  let settled = false
  const pending = invoke().then(result => { settled = true; return result })
  await jest.advanceTimersByTimeAsync(OUTSTAND_TIMEOUT_MS - 1)
  expect(settled).toBe(false)
  await jest.advanceTimersByTimeAsync(1)
  expect(settled).toBe(true)
  expectFailure(await pending, 504)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(jest.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true)
  if (phase === "body") expect(cancel).toHaveBeenCalled()
  expect(jest.getTimerCount()).toBe(0)
})

it.each(["headers", "body"])("shares one deadline across headers and body and later batches (%s stall)", async phase => {
  jest.useFakeTimers()
  load.mockResolvedValue({ data: record(linked(6)), error: null })
  const cancel = jest.fn()
  jest.mocked(fetch).mockImplementation(url => {
    if (!String(url).includes("/post-5?")) return new Promise(resolve => {
      setTimeout(() => resolve(successfulFetch(url)), 10_000)
    })
    if (phase === "headers") return new Promise(() => {})
    return new Promise(resolve => setTimeout(() => resolve(new Response(new ReadableStream({ cancel }), {
      headers: { "content-type": "application/json" },
    })), 10_000))
  })
  let settled = false
  const pending = invoke().then(result => { settled = true; return result })
  await jest.advanceTimersByTimeAsync(OUTSTAND_TIMEOUT_MS - 1)
  expect(fetch).toHaveBeenCalledTimes(6)
  expect(settled).toBe(false)
  await jest.advanceTimersByTimeAsync(1)
  expect(settled).toBe(true)
  expectFailure(await pending, 504)
  expect(jest.mocked(fetch).mock.calls[5][1]?.signal?.aborted).toBe(true)
  if (phase === "body") expect(cancel).toHaveBeenCalled()
  expect(jest.getTimerCount()).toBe(0)
})

it("bounds concurrency at five while checking every requested link", async () => {
  jest.useFakeTimers()
  load.mockResolvedValue({ data: record(linked(12)), error: null })
  let active = 0
  let peak = 0
  jest.mocked(fetch).mockImplementation(url => new Promise(resolve => {
    active += 1
    peak = Math.max(peak, active)
    setTimeout(() => { active -= 1; resolve(successfulFetch(url)) }, 100)
  }))
  const pending = invoke()
  await jest.advanceTimersByTimeAsync(0)
  expect(fetch).toHaveBeenCalledTimes(5)
  expect(active).toBe(5)
  await jest.advanceTimersByTimeAsync(300)
  expect(await pending).toMatchObject({ success: true, data: { linkedPostCount: 12 } })
  expect(peak).toBe(5)
  expect(active).toBe(0)
  expect(requestedIds()).toEqual(linked(12).map(tag => tag.slice("outstand_id_".length)))
  expect(jest.getTimerCount()).toBe(0)
})

it.each(["http://external.example.test", "https://user:password@api.example.test", "https://api.example.test/path", "https://127.0.0.2"])(
  "rejects unsafe API configuration: %s", async url => {
    process.env.API_SERVER_URL = url
    expectFailure(await invoke(), 503)
    expect(fetch).not.toHaveBeenCalled()
  },
)

it("reloads persisted links and reauthorizes every preview instead of caching prior permission", async () => {
  expect(await invoke()).toMatchObject({ success: true })
  load.mockResolvedValue({ data: record(["outstand_id_new-link"]), error: null })
  expect(await invoke()).toMatchObject({ success: true })
  expect(requestedIds()).toEqual(["post-one", "new-link"])
  rpc.mockResolvedValue({ data: false, error: null })
  expectFailure(await invoke(), 403)
  expect(load).toHaveBeenCalledTimes(3)
  expect(fetch).toHaveBeenCalledTimes(2)
})