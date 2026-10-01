/** @jest-environment node */

import { deleteContent } from "@/app/content/actions"
import type { DeleteContentOptions } from "@/app/content/delete-content-types"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { OUTSTAND_DELETE_TIMEOUT_MS, OUTSTAND_RESPONSE_LIMIT } from "@/app/content/outstand-http"

jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))

const contentId = "00000000-0000-4000-8000-000000000001"
const siteId = "00000000-0000-4000-8000-000000000002"
const otherSite = "00000000-0000-4000-8000-000000000003"
const userId = "user-one"
const updatedAt = "2026-09-30T12:00:00Z"
const environment = { ...process.env }
const getUser = jest.fn()
const getSession = jest.fn()
const rpc = jest.fn()
const load = jest.fn()
const remove = jest.fn()
const readEq = jest.fn(() => ({ maybeSingle: load }))
const readSelect = jest.fn(() => ({ eq: readEq }))
const deleteSelect = jest.fn(() => ({ maybeSingle: remove }))
const deleteQuery = { eq: jest.fn(), select: deleteSelect }
const deleteRow = jest.fn(() => deleteQuery)
const from = jest.fn(() => ({ select: readSelect, delete: deleteRow }))
const record = (tags: string[] | null = ["outstand_id_post-one"]) => ({ id: contentId, site_id: siteId, tags, updated_at: updatedAt })
const confirmation = (postId = "post-one") => ({ success: true, post_id: postId, delete_remote: true })
const invoke = () => deleteContent(contentId, { deleteFromOutstand: true })

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = "https://api.example.test"
  process.env.SERVICE_API_KEY = "never-forward-this"
  getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null })
  getSession.mockResolvedValue({ data: { session: { user: { id: userId }, access_token: "user-token" } }, error: null })
  rpc.mockImplementation(async (name: string) => ({ data: name === "current_user_site_role" ? "owner" : true, error: null }))
  load.mockResolvedValue({ data: record(), error: null })
  remove.mockResolvedValue({ data: { id: contentId }, error: null })
  deleteQuery.eq.mockReturnValue(deleteQuery)
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser, getSession }, rpc, from })
  jest.mocked(fetch).mockReset().mockImplementation(async () => Response.json(confirmation()))
})

afterEach(() => { jest.useRealTimers() })
afterAll(() => { process.env = environment })

it("deletes only local content by default with user authorization and RLS", async () => {
  expect(await deleteContent(contentId)).toEqual({ success: true })
  expect(createClient).toHaveBeenCalledWith(true)
  expect(createServiceClient).not.toHaveBeenCalled()
  expect(readSelect).toHaveBeenCalledWith("id, site_id, tags, updated_at")
  expect(readEq).toHaveBeenCalledWith("id", contentId)
  expect(rpc).toHaveBeenCalledWith("user_can", { p_site_id: siteId, p_command: "delete" })
  expect(deleteQuery.eq.mock.calls).toEqual([["id", contentId], ["site_id", siteId], ["updated_at", updatedAt]])
  expect(fetch).not.toHaveBeenCalled()
  expect(getSession).not.toHaveBeenCalled()
  expect(revalidatePath).toHaveBeenCalledWith("/content")
})

it("deletes every distinct persisted Outstand link before deleting local content", async () => {
  load.mockResolvedValue({ data: record(["outstand_id_post-one", "published_x", "outstand_id_post-two", "outstand_id_post-one"]), error: null })
  jest.mocked(fetch).mockImplementation(async url => {
    expect(deleteRow).not.toHaveBeenCalled()
    return Response.json(confirmation(String(url).includes("post-two") ? "post-two" : "post-one"))
  })
  expect(await invoke()).toEqual({ success: true })
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(fetch).toHaveBeenCalledWith(new URL(`https://api.example.test/api/integrations/outstand/posts/post-one/with-content?tenant_id=${siteId}`), {
    method: "DELETE", cache: "no-store", redirect: "error", signal: expect.any(AbortSignal),
    headers: { Authorization: "Bearer user-token", Accept: "application/json" },
  })
  expect(getUser).toHaveBeenCalledTimes(2)
  expect(deleteRow).toHaveBeenCalledTimes(1)
  expect(JSON.stringify(jest.mocked(fetch).mock.calls)).not.toContain(process.env.SERVICE_API_KEY)
})

it.each([null, { deleteFromOutstand: "true" }, { deleteFromOutstand: true, siteId: otherSite }])(
  "rejects malformed or injected deletion options", async options => {
    expect(await deleteContent(contentId, options as DeleteContentOptions)).toMatchObject({ success: false, status: 400 })
    expect(createClient).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  },
)

it.each(["../bad", "outstand-post-one", "", "demo-site"])("rejects malformed content IDs: %s", async id => {
  expect(await deleteContent(id)).toMatchObject({ success: false, status: 400 })
  expect(createClient).not.toHaveBeenCalled()
})

it("rejects anonymous deletion before loading content", async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null })
  expect(await invoke()).toMatchObject({ success: false, status: 401 })
  expect(from).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it("does not delete content hidden by cross-tenant RLS", async () => {
  load.mockResolvedValue({ data: null, error: null })
  expect(await invoke()).toMatchObject({ success: false, status: 404 })
  expect(deleteRow).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it.each([false, null, "true"])("rejects absent delete capability: %s", async capability => {
  rpc.mockResolvedValue({ data: capability, error: null })
  expect(await invoke()).toMatchObject({ success: false, status: 403 })
  expect(fetch).not.toHaveBeenCalled()
  expect(deleteRow).not.toHaveBeenCalled()
})

it("fails closed on permission RPC errors", async () => {
  rpc.mockResolvedValue({ data: true, error: { message: "private DB detail" } })
  expect(await invoke()).toMatchObject({ success: false, status: 403 })
  expect(fetch).not.toHaveBeenCalled()
})

it("requires a verified matching session before requesting remote deletion", async () => {
  getSession.mockResolvedValue({ data: { session: { user: { id: "other-user" }, access_token: "other-token" } }, error: null })
  expect(await invoke()).toMatchObject({ success: false, status: 401 })
  expect(fetch).not.toHaveBeenCalled()
  expect(deleteRow).not.toHaveBeenCalled()
})

it.each([null, [], ["published_x"], ["outstand_id_"], ["outstand_id_../foreign"], ["outstand_id_post?tenant_id=other"]])(
  "rejects missing and unsafe links without guessing from content text", async tags => {
    load.mockResolvedValue({ data: record(tags), error: null })
    expect(await invoke()).toMatchObject({ success: false, status: 400 })
    expect(fetch).not.toHaveBeenCalled()
    expect(deleteRow).not.toHaveBeenCalled()
  },
)

it.each([401, 403, 404, 409, 429, 500, 503])("preserves content after API HTTP %i and never exposes raw errors", async status => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ error: "private-provider-token" }, { status }))
  const result = await invoke()
  expect(result).toMatchObject({ success: false, error: expect.stringContaining("Local content was not deleted") })
  expect(JSON.stringify(result)).not.toContain("private-provider-token")
  expect(deleteRow).not.toHaveBeenCalled()
  expect(revalidatePath).not.toHaveBeenCalled()
  expect(fetch).toHaveBeenCalledTimes(1)
})

it("does not assume a platform-specific cause on conflict and only deletes locally after an explicit new request", async () => {
  load.mockResolvedValue({ data: record(["outstand_id_instagram-post", "outstand_id_tiktok-post"]), error: null })
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ success: false, error: "private-provider-detail" }, { status: 409 }))

  const result = await invoke()
  expect(result).toMatchObject({ success: false, status: 409 })
  expect(result.error).toContain("post status, platform support or permissions may have changed")
  expect(result.error).not.toMatch(/Instagram|TikTok/)
  expect(result.error).toContain("local-only deletion")
  expect(result.error).toContain("Local content was not deleted")
  expect(result.error).not.toContain("private-provider-detail")
  expect(deleteRow).not.toHaveBeenCalled()
  expect(revalidatePath).not.toHaveBeenCalled()
  expect(fetch).toHaveBeenCalledTimes(1)

  expect(await deleteContent(contentId, { deleteFromOutstand: false })).toEqual({ success: true })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(deleteRow).toHaveBeenCalledTimes(1)
  expect(createServiceClient).not.toHaveBeenCalled()
  expect(revalidatePath).toHaveBeenCalledWith("/content")
})

it.each([
  {}, { success: true }, { success: false },
  { ...confirmation(), delete_remote: false },
  { ...confirmation(), degraded: true },
  { ...confirmation(), post_id: "other-post" },
  { ...confirmation(), tenant_id: otherSite },
  { ...confirmation(), error: "private-provider-token" },
  { ...confirmation(), results: [{ status: "deleted" }, { status: "failed", error: "private-provider-token" }] },
  { ...confirmation(), results: "invalid" },
])("rejects partial/legacy/malformed confirmations", async body => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(body))
  const result = await invoke()
  expect(result.success).toBe(false)
  expect(JSON.stringify(result)).not.toContain("private-provider-token")
  expect(deleteRow).not.toHaveBeenCalled()
})

it("keeps local content and stops when a later linked post fails", async () => {
  load.mockResolvedValue({ data: record(["outstand_id_post-one", "outstand_id_post-two", "outstand_id_post-three"]), error: null })
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(confirmation()))
    .mockResolvedValueOnce(Response.json({ success: false }, { status: 409 }))
  expect((await invoke()).success).toBe(false)
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(deleteRow).not.toHaveBeenCalled()
})

it("reports local deletion failure after confirmed social deletion", async () => {
  remove.mockResolvedValue({ data: null, error: { message: "private DB detail" } })
  expect(await invoke()).toMatchObject({ success: false, status: 409, error: expect.stringContaining("Social posts were deleted") })
  expect(revalidatePath).not.toHaveBeenCalled()
})

it("does not claim local success if RLS or concurrent edits prevent deletion", async () => {
  remove.mockResolvedValue({ data: null, error: null })
  expect(await deleteContent(contentId)).toMatchObject({ success: false, status: 409 })
})

it("bounds remote responses and refuses redirects", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json(confirmation(), { headers: { "content-length": String(OUTSTAND_RESPONSE_LIMIT + 1) } }))
  expect((await invoke()).success).toBe(false)
  jest.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: "https://other.test" } }))
  expect((await invoke()).success).toBe(false)
  expect(deleteRow).not.toHaveBeenCalled()
})

it.each(["headers", "body"])("times out stalled %s without retries or local deletion", async phase => {
  jest.useFakeTimers()
  if (phase === "headers") jest.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}))
  else jest.mocked(fetch).mockResolvedValueOnce(new Response(new ReadableStream(), { headers: { "content-type": "application/json" } }))
  const pending = invoke()
  await jest.advanceTimersByTimeAsync(OUTSTAND_DELETE_TIMEOUT_MS + 1)
  expect(await pending).toMatchObject({ success: false, status: 504 })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(jest.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true)
  expect(deleteRow).not.toHaveBeenCalled()
  expect(jest.getTimerCount()).toBe(0)
})

it("rechecks permissions on subsequent deletion attempts", async () => {
  expect((await invoke()).success).toBe(true)
  rpc.mockResolvedValue({ data: false, error: null })
  expect(await invoke()).toMatchObject({ success: false, status: 403 })
  expect(fetch).toHaveBeenCalledTimes(1)
})