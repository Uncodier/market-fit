/** @jest-environment node */
import { randomBytes } from "node:crypto"
import { NextRequest } from "next/server"
import { POST as connectBluesky } from "@/app/api/social/bluesky/connect/route"
import { POST as startOAuth } from "@/app/api/social/[network]/auth-url/route"
import { POST as finalizeOAuth } from "@/app/api/social/accounts/pending/[sessionToken]/finalize/route"
import { GET as oauthCallback } from "@/app/api/social/callback/[network]/route"
import { createSocialSupabaseClient } from "@/app/api/social/supabase-client"
import { lookupCurrentUserSiteRole } from "@/lib/auth/site-role-lookup"

jest.mock("@/app/api/social/supabase-client", () => ({ createSocialSupabaseClient: jest.fn(), SocialLocationAccessError: class extends Error {} }))
jest.mock("@/lib/auth/site-role-lookup", () => ({ lookupCurrentUserSiteRole: jest.fn(), SiteRoleLookupError: class extends Error {} }))
jest.mock("@/lib/auth/api-site-access", () => ({ isSiteManagerRole: (role: string) => ["owner", "admin"].includes(role) }))
jest.mock("@/lib/api-server-url", () => ({ getOutstandIntegrationUrl: (path: string) => `https://integration.example.invalid${path}` }))

const siteId = "00000000-0000-4000-8000-000000000001"
const secret = randomBytes(12).toString("hex")
const origin = "https://app.example.invalid"
const account = { id: "remote-one", network: "bluesky", username: "studio.bsky.social" }
const credentials = { siteId, handle: " @Studio.Bsky.Social ", app_password: secret }
const makeRequest = (path: string, body: unknown) => new NextRequest(`${origin}${path}`, {
  method: "POST", headers: { origin, host: "app.example.invalid", "content-type": "application/json" }, body: JSON.stringify(body),
})
const bluesky = () => makeRequest("/api/social/bluesky/connect", credentials)
const oauth = () => makeRequest("/api/social/twitter/auth-url", {
  tenant_id: siteId, redirect_uri: `${origin}/api/social/callback/twitter?siteId=${siteId}`,
})
const stored = jest.fn()
const update = jest.fn()
const read = jest.fn()
const previousKey = process.env.SERVICE_API_KEY
let fetchMock: jest.SpiedFunction<typeof fetch>

beforeEach(() => {
  jest.clearAllMocks()
  process.env.SERVICE_API_KEY = randomBytes(16).toString("hex")
  fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ success: true, data: { ...account, tokens: { access_token: secret } } }))
  jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue("owner")
  read.mockResolvedValue({ data: { settings: { id: "settings", updated_at: "version-one", social_media: [] }, billing: { plan: "commission" } } })
  stored.mockResolvedValue({ data: { id: "settings" } })
  const siteQuery = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(), overrideTypes: read }
  const settingsQuery = { update, eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), maybeSingle: stored }
  update.mockReturnValue(settingsQuery)
  jest.mocked(createSocialSupabaseClient).mockResolvedValue({ from: (table: string) => table === "sites" ? siteQuery : settingsQuery } as never)
})

afterEach(() => {
  jest.restoreAllMocks()
  if (previousKey === undefined) delete process.env.SERVICE_API_KEY
  else process.env.SERVICE_API_KEY = previousKey
})

it("persists only the Bluesky account returned by Outstand and never leaks the password or tokens", async () => {
  const response = await connectBluesky(bluesky())
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ success: true })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ ...credentials, handle: account.username })
  expect(update.mock.calls[0][0].social_media).toMatchObject([{ ...account, platform: "bluesky", isActive: true }])
  expect(JSON.stringify(update.mock.calls)).not.toContain(secret)
})

it("does not invoke the provider for a tenant without manager access", async () => {
  jest.mocked(lookupCurrentUserSiteRole).mockResolvedValue("collaborator")
  expect((await connectBluesky(bluesky())).status).toBe(403)
  expect((await startOAuth(oauth(), { params: Promise.resolve({ network: "twitter" }) })).status).toBe(403)
  const finalize = makeRequest("/api/social/accounts/pending/pending-token/finalize", { siteId, network: "twitter", selectedPageIds: ["page"] })
  expect((await finalizeOAuth(finalize, { params: Promise.resolve({ sessionToken: "pending-token" }) })).status).toBe(403)
  expect(fetchMock).not.toHaveBeenCalled()
})

it("returns an X selection session only to the configured application origin", async () => {
  const request = new NextRequest(`https://app.makinari.com/api/social/callback/twitter?session=${secret}&siteId=${siteId}`, {
    headers: { "x-forwarded-host": "other.example.invalid" },
  })
  const response = await oauthCallback(request, { params: Promise.resolve({ network: "twitter" }) })
  const location = new URL(response.headers.get("location")!)
  expect(location.origin).toBe("https://app.makinari.com")
  expect(location.pathname).toBe("/settings/social_network")
  expect(location.searchParams.get("siteId")).toBe(siteId)
})

it("blocks adding a Bluesky account at capacity but lets the same active handle reconnect", async () => {
  const active = { ...account, platform: "bluesky", isActive: true }
  read.mockResolvedValueOnce({ data: { settings: { social_media: [{ ...active, username: "another.bsky.social" }] }, billing: { plan: "commission" } } })
    .mockResolvedValueOnce({ data: { settings: { social_media: [active] }, billing: { plan: "commission" } } })
  expect((await connectBluesky(bluesky())).status).toBe(403)
  expect(fetchMock).not.toHaveBeenCalled()
  expect((await connectBluesky(bluesky())).status).toBe(200)
  expect(update.mock.calls[0][0].social_media).toHaveLength(1)
})

it("uses a current temporary workspace license for the Bluesky capacity check", async () => {
  read.mockResolvedValueOnce({ data: {
    settings: { id: "settings", updated_at: "version-one", social_media: [{ id: "existing", platform: "instagram", isActive: true }] },
    billing: { plan: "commission", temporary_workspace_license: { plan: "foundry", ends_at: "2090-12-25T00:00:00Z" } },
  } })
  expect((await connectBluesky(bluesky())).status).toBe(200)
})

it("does not claim success if settings changed after Bluesky accepted the connection", async () => {
  stored.mockResolvedValue({ data: null, error: null })
  const response = await connectBluesky(bluesky())
  expect(response.status).toBe(409)
  expect(await response.json()).toMatchObject({ success: false, connected: true })
})

it.each(["twitter", "x"])("starts OAuth for %s through the canonical X network and preserves its callback alias", async network => {
  fetchMock.mockResolvedValueOnce(Response.json({ success: true, data: { auth_url: "https://x.com/i/oauth2/authorize" } }))
  const response = await startOAuth(oauth(), { params: Promise.resolve({ network }) })
  expect(response.status).toBe(200)
  expect(fetchMock.mock.calls[0][0]).toBe(`https://integration.example.invalid/social-networks/x/auth-url?siteId=${siteId}`)
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ tenant_id: siteId,
    redirect_uri: `${origin}/api/social/callback/${network}?siteId=${siteId}` })
})

it("does not send OAuth credentials to an unapproved callback origin", async () => {
  const request = makeRequest("/api/social/twitter/auth-url", { tenant_id: siteId, redirect_uri: "https://other.example.invalid" })
  expect((await startOAuth(request, { params: Promise.resolve({ network: "twitter" }) })).status).toBe(400)
  expect(fetchMock).not.toHaveBeenCalled()
})