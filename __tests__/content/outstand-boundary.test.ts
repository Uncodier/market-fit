/** @jest-environment node */

import { fetchOutstandPosts, publishOutstandPost } from "@/app/content/outstand"
import { createClient } from "@/lib/supabase/server"
import { OUTSTAND_RESPONSE_LIMIT, OUTSTAND_TIMEOUT_MS } from "@/app/content/outstand-http"
import { isOutstandMediaUrl } from "@/app/content/outstand-media"

jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const siteId = "00000000-0000-4000-8000-000000000001"
const otherSite = "00000000-0000-4000-8000-000000000002"
const environment = { ...process.env }
const privateDetail = "private-provider-credential-and-error"
const payload = { tenant_id: siteId, containers: [{ content: "private post text", media: [] }], accounts: ["account-one"] }
const post = { id: "post-one", containers: payload.containers, socialAccounts: [{ id: "account-one", platformPostId: "platform-one" }] }
const publish = () => publishOutstandPost(siteId, payload)

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = "https://api.example.test"
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project-one.supabase.co"
  delete process.env.SUPABASE_URL
  jest.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-one" } }, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: "user-one" }, access_token: "user-token" } }, error: null }),
    },
    rpc: jest.fn(async (name: string) => ({ data: name === "current_user_site_role" ? "owner" : true, error: null })),
    from: jest.fn(() => ({ select: jest.fn(() => ({ eq: jest.fn(() => ({
      maybeSingle: jest.fn().mockResolvedValue({ data: { site_id: siteId, social_media: [{ id: "account-one", isActive: true }] }, error: null }),
    })) })) })),
  })
  jest.mocked(fetch).mockReset().mockResolvedValue(Response.json({ success: true, post }))
})

afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })
afterAll(() => { process.env = environment })

it.each([401, 403, 429, 503])("preserves upstream HTTP %i failures without data or details", async status => {
  for (const action of [publish, () => fetchOutstandPosts(siteId)]) {
    const response = Response.json({ error: privateDetail, details: privateDetail, success: true }, { status })
    const cancel = jest.spyOn(response.body!, "cancel")
    jest.mocked(fetch).mockResolvedValueOnce(response)
    const result = await action()
    expect(result).toMatchObject({ success: false, status })
    expect(result).not.toHaveProperty("data")
    expect(result).not.toHaveProperty("details")
    expect(JSON.stringify(result)).not.toContain(privateDetail)
    expect(cancel).toHaveBeenCalled()
  }
})

it.each([
  {}, { success: "true", post }, { success: true }, { success: false, error: privateDetail },
  { success: true, error: privateDetail, post }, { success: true, post: {} },
  { success: true, post: { ...post, isDraft: true } },
  { success: true, post: { ...post, tenant_id: otherSite } },
  { success: true, tenant_id: otherSite, post },
  { success: true, post: { ...post, socialAccounts: [{ id: "account-one", status: "failed", error: privateDetail }] } },
])("never invents successful publication from invalid or failed results", async body => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(body))
  const result = await publish()
  expect(result).toMatchObject({ success: false, status: 502 })
  expect(JSON.stringify(result)).not.toContain(privateDetail)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it.each([{}, { success: true }, { success: false, posts: [] }, { success: true, posts: {} },
  { success: true, posts: null, data: [] }, { success: true, posts: [{ ...post, tenant_id: otherSite }] },
])("does not disguise malformed list responses as an empty list", async body => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(body))
  const result = await fetchOutstandPosts(siteId)
  expect(result).toMatchObject({ success: false, status: 502 })
  expect(result).not.toHaveProperty("data")
})

it.each(["posts", "data"])("accepts explicit successful empty %s lists", async key => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ success: true, [key]: [] }))
  expect(await fetchOutstandPosts(siteId)).toEqual({ data: [] })
})

it.each(["post", "data", "root"])("preserves %s result fields used by live callers, removing private extras", async key => {
  const raw = { ...post, orgId: privateDetail, access_token: privateDetail, metadata: { privateDetail },
    socialAccounts: [{ ...post.socialAccounts[0], access_token: privateDetail }] }
  const body = key === "root" ? { success: true, ...raw } : { success: true, [key]: raw, details: privateDetail }
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(body))
  const result = await publish()
  expect(result).toEqual({ success: true, data: key === "root" ? { ...post, success: true } : { success: true, [key]: post } })
  expect(JSON.stringify(result)).not.toContain(privateDetail)
})

it("redacts per-account errors when reading posts", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ success: true, posts: [{ ...post,
    socialAccounts: [{ id: "account-one", status: "failed", error: privateDetail }],
  }] }))
  const result = await fetchOutstandPosts(siteId)
  expect(result.data?.[0].socialAccounts?.[0].error).toBe("Social account delivery failed.")
  expect(JSON.stringify(result)).not.toContain(privateDetail)
})

it("never logs input, tokens, provider bodies, stacks or thrown errors", async () => {
  const spies = [jest.spyOn(console, "log"), jest.spyOn(console, "warn"), jest.spyOn(console, "error")]
  await publish()
  jest.mocked(fetch).mockRejectedValueOnce(new Error(privateDetail))
  expect(await publish()).toMatchObject({ success: false, status: 502 })
  jest.mocked(fetch).mockResolvedValueOnce(new Response(privateDetail, { headers: { "content-type": "application/json" } }))
  expect(await fetchOutstandPosts(siteId)).toMatchObject({ success: false, status: 502 })
  for (const spy of spies) expect(spy).not.toHaveBeenCalled()
})

it.each(["<html>private</html>", "", "{bad-json"])("rejects malformed JSON safely (%s)", async text => {
  jest.mocked(fetch).mockResolvedValueOnce(new Response(text, { headers: { "content-type": "application/json" } }))
  expect(await publish()).toMatchObject({ success: false, status: 502 })
})

it("rejects non-JSON and redirects without following a location", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ success: true, post })))
  expect(await publish()).toMatchObject({ success: false, status: 502 })
  jest.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: "https://other.example.test" } }))
  expect(await publish()).toMatchObject({ success: false, status: 502 })
  expect(fetch).toHaveBeenCalledTimes(2)
  for (const [, options] of jest.mocked(fetch).mock.calls) expect(options?.redirect).toBe("error")
})

it("bounds responses from both declared length and actual streamed bytes", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ success: true, post }, { headers: { "content-length": String(OUTSTAND_RESPONSE_LIMIT + 1) } }))
  expect(await publish()).toMatchObject({ success: false, status: 502 })
  const cancel = jest.fn()
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(OUTSTAND_RESPONSE_LIMIT + 1)) }, cancel,
  })
  jest.mocked(fetch).mockResolvedValueOnce(new Response(stream, { headers: { "content-type": "application/json", "content-length": "1" } }))
  expect(await publish()).toMatchObject({ success: false, status: 502 })
  expect(cancel).toHaveBeenCalled()
})

it.each(["headers", "body"])("times out stalled %s, aborts, and never retries publishing", async phase => {
  jest.useFakeTimers()
  const cancel = jest.fn()
  if (phase === "headers") jest.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}))
  else jest.mocked(fetch).mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { headers: { "content-type": "application/json" } }))
  const pending = publish()
  await jest.advanceTimersByTimeAsync(OUTSTAND_TIMEOUT_MS + 1)
  expect(await pending).toMatchObject({ success: false, status: 504, error: expect.stringContaining("before retrying") })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(jest.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true)
  if (phase === "body") expect(cancel).toHaveBeenCalled()
  expect(jest.getTimerCount()).toBe(0)
})

it.each([
  "http://external.example.test", "https://name:password@api.example.test", "https://api.example.test?target=other",
  "https://api.example.test/path", "https://api.example.test#hash", "https://127.0.0.2", "https://api.example.test:8443",
])("fails closed on unsafe API configuration: %s", async value => {
  process.env.API_SERVER_URL = value
  expect(await publish()).toMatchObject({ success: false, status: 503 })
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  "http://media.outstand.so/org/image.jpg", "https://attacker.test/image.jpg", "https://127.0.0.1/image.jpg",
  "https://media.outstand.so.attacker.test/image.jpg", "https://media.outstand.so@attacker.test/image.jpg",
  "https://media.outstand.so:8443/image.jpg", "https://media.outstand.so/org/../image.jpg",
  "https://media.outstand.so/org/%2e%2e/image.jpg", "https://media.outstand.so/org/%252e%252e/image.jpg",
  "https://other-project.supabase.co/storage/v1/object/public/assets/image.jpg",
  "https://db.makinari.com/storage/v1/object/sign/assets/image.jpg",
  "data:image/png;base64,abc", "file:///image.jpg", "https://media.outstand.so/",
])("rejects untrusted media targets: %s", value => {
  expect(isOutstandMediaUrl(value)).toBe(false)
})

it.each([
  "https://media.outstand.so/org/file/clip.mp4",
  "https://media.outstand.so/renditions/org/file/image.webp?width=640",
  "https://project-one.supabase.co/storage/v1/object/public/assets/launch%20image.png",
  "https://db.makinari.com/storage/v1/object/public/generative_videos/clip.mp4",
])("accepts the supported provider/storage media contract: %s", value => {
  expect(isOutstandMediaUrl(value)).toBe(true)
})