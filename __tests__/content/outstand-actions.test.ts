/** @jest-environment node */

import { fetchOutstandPosts, publishOutstandPost } from "@/app/content/outstand"
import { createClient } from "@/lib/supabase/server"
import type { OutstandPublishInput } from "@/app/content/outstand-contract"

jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const siteId = "00000000-0000-4000-8000-000000000001"
const otherSite = "00000000-0000-4000-8000-000000000002"
const userId = "00000000-0000-4000-8000-000000000003"
const apiUrl = "https://api.example.test"
const environment = { ...process.env }
const getUser = jest.fn()
const getSession = jest.fn()
const rpc = jest.fn()
const maybeSingle = jest.fn()
const eq = jest.fn(() => ({ maybeSingle }))
const select = jest.fn(() => ({ eq }))
const from = jest.fn(() => ({ select }))
const payload = (): OutstandPublishInput => ({
  tenant_id: siteId,
  containers: [{ content: "Launch\nhttps://example.test #news", media: [] }],
  accounts: ["Account name"],
})
const settings = (socialMedia: unknown, tenant = siteId) => {
  maybeSingle.mockResolvedValue({ data: { site_id: tenant, social_media: socialMedia }, error: null })
}
const invoke = (input: unknown) => publishOutstandPost(siteId, input as OutstandPublishInput)
const post = { id: "post-one", socialAccounts: [{ id: "account-one", platformPostId: "platform-one", status: "published" }] }

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = apiUrl
  process.env.NEXT_PUBLIC_API_SERVER_URL = "https://unused.example.test"
  process.env.SERVICE_API_KEY = "must-never-be-forwarded"
  getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null })
  getSession.mockResolvedValue({ data: { session: { user: { id: userId }, access_token: "current-user-token" } }, error: null })
  rpc.mockImplementation(async (name: string) => ({ data: name === "current_user_site_role" ? "collaborator" : true, error: null }))
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser, getSession }, rpc, from })
  settings([{ id: "account-one", accountName: "Account name", username: "username", isActive: true }])
  jest.mocked(fetch).mockReset().mockResolvedValue(Response.json({ success: true, post }))
})

afterAll(() => { process.env = environment })

it("authorizes publishing and forwards the matching bearer and canonical account ID only", async () => {
  const result = await publishOutstandPost(siteId, payload())
  expect(result).toEqual({ success: true, data: { success: true, post } })
  expect(createClient).toHaveBeenCalledWith(true)
  expect(getUser).toHaveBeenCalledTimes(1)
  expect(rpc.mock.calls).toEqual([
    ["current_user_site_role", { p_site_id: siteId }],
    ["user_can", { p_site_id: siteId, p_command: "insert" }],
  ])
  expect(from).toHaveBeenCalledWith("settings")
  expect(select).toHaveBeenCalledWith("site_id, social_media")
  expect(eq).toHaveBeenCalledWith("site_id", siteId)
  expect(fetch).toHaveBeenCalledWith(new URL(`${apiUrl}/api/integrations/outstand/posts?tenant_id=${siteId}`), {
    method: "POST", cache: "no-store", redirect: "error", signal: expect.any(AbortSignal),
    headers: { Authorization: "Bearer current-user-token", Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload(), accounts: ["account-one"] }),
  })
  expect(JSON.stringify(jest.mocked(fetch).mock.calls)).not.toContain(process.env.SERVICE_API_KEY)
})

it("authorizes the exported fetch using select, not a write capability", async () => {
  rpc.mockImplementation(async (name: string) => ({ data: name === "current_user_site_role" ? "marketing" : true, error: null }))
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ success: true, posts: [post] }))
  expect(await fetchOutstandPosts(siteId)).toEqual({ data: [post] })
  expect(rpc).toHaveBeenCalledWith("user_can", { p_site_id: siteId, p_command: "select" })
  expect(from).not.toHaveBeenCalled()
  expect(fetch).toHaveBeenCalledWith(new URL(`${apiUrl}/api/integrations/outstand/posts?tenant_id=${siteId}&limit=50`), expect.objectContaining({
    method: "GET", headers: { Authorization: "Bearer current-user-token", Accept: "application/json" },
    cache: "no-store", redirect: "error", signal: expect.any(AbortSignal),
  }))
})

it.each(["demo-site", "", "not-a-uuid", `${siteId}&tenant_id=${otherSite}`])("rejects invalid site IDs: %s", async value => {
  expect(await publishOutstandPost(value, payload())).toMatchObject({ success: false, status: 400 })
  expect(await fetchOutstandPosts(value)).toMatchObject({ success: false, status: 400 })
  expect(createClient).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  { data: { user: null }, error: null },
  { data: { user: { id: userId } }, error: { message: "private auth error" } },
])("denies both actions without a verified user", async response => {
  getUser.mockResolvedValue(response)
  for (const result of [await invoke(payload()), await fetchOutstandPosts(siteId)]) {
    expect(result).toMatchObject({ success: false, status: 401 })
    expect(result).not.toHaveProperty("data")
  }
  expect(rpc).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it.each([null, "", "unexpected-role", ["owner"]])("denies missing, archived or malformed memberships (%j)", async role => {
  rpc.mockResolvedValue({ data: role, error: null })
  expect(await invoke(payload())).toMatchObject({ success: false, status: 403 })
  expect(await fetchOutstandPosts(siteId)).toMatchObject({ success: false, status: 403 })
  expect(getSession).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it.each([false, null, "true"]) ("requires explicit capability permission (%j)", async permission => {
  rpc.mockImplementation(async (name: string) => ({ data: name === "current_user_site_role" ? "marketing" : permission, error: null }))
  expect(await invoke(payload())).toMatchObject({ success: false, status: 403 })
  expect(await fetchOutstandPosts(siteId)).toMatchObject({ success: false, status: 403 })
  expect(fetch).not.toHaveBeenCalled()
})

it.each(["current_user_site_role", "user_can"]) ("fails closed on %s RPC errors", async failed => {
  rpc.mockImplementation(async (name: string) => ({
    data: name === "current_user_site_role" ? "owner" : true,
    error: name === failed ? { message: "private database failure" } : null,
  }))
  expect(await invoke(payload())).toMatchObject({ success: false, status: 403 })
  expect(await fetchOutstandPosts(siteId)).toMatchObject({ success: false, status: 403 })
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  { session: null, error: null },
  { session: { user: { id: "other-user" }, access_token: "wrong" }, error: null },
  { session: { user: { id: userId }, access_token: "" }, error: null },
  { session: { user: { id: userId }, access_token: "token\r\ninjection" }, error: null },
  { session: { user: { id: userId }, access_token: "token" }, error: { message: "private" } },
])("requires a matching session before calling the API", async ({ session, error }) => {
  getSession.mockResolvedValue({ data: { session }, error })
  expect(await invoke(payload())).toMatchObject({ success: false, status: 401 })
  expect(await fetchOutstandPosts(siteId)).toMatchObject({ success: false, status: 401 })
  expect(fetch).not.toHaveBeenCalled()
})

it("rejects tenant mismatch before loading accounts or forwarding", async () => {
  expect(await invoke({ ...payload(), tenant_id: otherSite })).toMatchObject({ success: false, status: 403 })
  expect(from).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  null, [], {}, { ...payload(), accounts: [] }, { ...payload(), accounts: [null] },
  { ...payload(), accounts: [" "] }, { ...payload(), accounts: ["name\n"] },
  { ...payload(), containers: [] }, { ...payload(), containers: [{ content: "  ", media: [] }] },
  { ...payload(), scheduledAt: "tomorrow" }, { ...payload(), scheduledAt: "2026-02-30T12:00:00Z" },
  { ...payload(), user_id: userId }, { ...payload(), containers: [{ content: "text", media: ["https://example.test"] }] },
  { ...payload(), containers: [{ content: "text", media: [{ url: "https://media.outstand.so/org/file/image.jpg", filename: "../file" }] }] },
  { ...payload(), containers: [{ content: "a".repeat(100_001), media: [] }] },
])("rejects malformed payloads", async input => {
  expect(await invoke(input)).toMatchObject({ success: false, status: 400 })
  expect(from).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it("bounds the full UTF-8 payload size", async () => {
  expect(await invoke({ ...payload(), containers: Array.from({ length: 6 }, () => ({ content: "a".repeat(100_000), media: [] })) }))
    .toMatchObject({ success: false, status: 413 })
  expect(fetch).not.toHaveBeenCalled()
})

it("retains supported attachments, media-only containers and scheduling", async () => {
  const input = { ...payload(), scheduledAt: "2027-10-01T12:00:00+02:00", containers: [
    { content: "", media: [{ id: "media-one", url: "https://media.outstand.so/org/file/video.mp4", filename: "video.mp4" }] },
    { content: "caption", media: [{ url: "https://db.makinari.com/storage/v1/object/public/assets/image.png", filename: "image.png" }] },
  ] }
  expect(await invoke(input)).toMatchObject({ success: true })
  expect(JSON.parse(jest.mocked(fetch).mock.calls[0][1]?.body as string)).toEqual({ ...input, accounts: ["account-one"] })
})

it("supports stored IDs, legacy fields, exact usernames and connected pages without forwarding names", async () => {
  settings([
    { account_id: "legacy-one", username: "legacy-user", isActive: 1 },
    { accountId: "legacy-two", accountName: "Second", isActive: true },
    { id: "parent", connectedPages: [{ id: "page-one", name: "Page Name", username: "page-user" }] },
  ])
  expect(await invoke({ ...payload(), accounts: ["legacy-user", "legacy-one", "Second", "Page Name", "page-user"] }))
    .toMatchObject({ success: true })
  expect(JSON.parse(jest.mocked(fetch).mock.calls[0][1]?.body as string).accounts).toEqual(["legacy-one", "legacy-two", "page-one"])
})

it.each([
  [], null,
  [{ id: "other-account", isActive: true, username: "other" }],
  [{ id: "account-one", accountName: "Account name", isActive: false }],
  [{ id: "account-one", accountName: "Account name", isActive: true, tenant_id: otherSite }],
  [{ id: "account-one", accountName: "Account name", isActive: true }, { id: "account-two", username: "Account name", isActive: true }],
  [{ id: "parent", isActive: false, connectedPages: [{ id: "page-one", name: "Account name" }] }],
  [{ id: "parent", isActive: true, connectedPages: [{ id: "page-one", name: "Account name", site_id: otherSite }] }],
])("rejects unknown, inactive, foreign or ambiguous accounts", async rows => {
  settings(rows)
  expect(await invoke(payload())).toMatchObject({ success: false, status: 403 })
  expect(fetch).not.toHaveBeenCalled()
})

it("never interprets a platform name as authority to publish", async () => {
  settings([{ id: "account-one", platform: "facebook", username: "site-user", isActive: true }])
  expect(await invoke({ ...payload(), accounts: ["facebook"] })).toMatchObject({ success: false, status: 403 })
  expect(fetch).not.toHaveBeenCalled()
})

it("fails closed on missing/foreign settings and database failures", async () => {
  maybeSingle.mockResolvedValueOnce({ data: null, error: null })
  expect(await invoke(payload())).toMatchObject({ success: false, status: 403 })
  settings([{ id: "account-one", accountName: "Account name", isActive: true }], otherSite)
  expect(await invoke(payload())).toMatchObject({ success: false, status: 403 })
  maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "private DB message" } })
  expect(await invoke(payload())).toMatchObject({ success: false, status: 503 })
  expect(fetch).not.toHaveBeenCalled()
})

it("rechecks authorization on every invocation, including concurrent requests", async () => {
  await Promise.all([invoke(payload()), invoke(payload())])
  expect(getUser).toHaveBeenCalledTimes(2)
  expect(rpc).toHaveBeenCalledTimes(4)
  expect(fetch).toHaveBeenCalledTimes(2)
  rpc.mockResolvedValue({ data: null, error: null })
  expect(await invoke(payload())).toMatchObject({ success: false, status: 403 })
  expect(fetch).toHaveBeenCalledTimes(2)
})