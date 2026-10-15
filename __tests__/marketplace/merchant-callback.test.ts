/** @jest-environment node */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/auth/api-site-access", () => ({ requireSiteAccess: jest.fn() }))
jest.mock("@/lib/marketplace/merchant/session", () => ({ claimMerchantAuthorization: jest.fn(), completeMerchantAuthorization: jest.fn() }))
jest.mock("@/lib/marketplace/merchant/platform", () => ({ merchantCallbackUrl: () => "https://app.example.test/api/marketplace/oauth/uber_eats/callback" }))
import { NextRequest } from "next/server"
import { randomBytes, randomUUID } from "node:crypto"
import { GET } from "@/app/api/marketplace/oauth/[provider]/callback/route"
import { createClient } from "@/lib/supabase/server"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { claimMerchantAuthorization, completeMerchantAuthorization } from "@/lib/marketplace/merchant/session"

describe("merchant OAuth callback boundaries", () => {
  beforeEach(() => jest.clearAllMocks())
  const parameters = { params: Promise.resolve({ provider: "uber_eats" }) }
  it("rejects a callback that did not originate from this browser before token exchange", async () => {
    const url = new URL("https://app.example.test/api/marketplace/oauth/uber_eats/callback")
    url.searchParams.set("state", randomBytes(32).toString("base64url"))
    url.searchParams.set("code", randomBytes(24).toString("hex"))
    const response = await GET(new NextRequest(url), parameters)
    expect(response.status).toBe(400)
    expect(claimMerchantAuthorization).not.toHaveBeenCalled()
    expect(completeMerchantAuthorization).not.toHaveBeenCalled()
  })
  it("binds callbacks to the signed-in manager and strips the code/state from redirects", async () => {
    const actor = randomUUID(), state = randomBytes(32).toString("base64url"), code = randomBytes(24).toString("hex")
    const site = randomUUID(), connection = randomUUID()
    const url = new URL("https://app.example.test/api/marketplace/oauth/uber_eats/callback")
    url.searchParams.set("state", state); url.searchParams.set("code", code)
    jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({data:{user:{id:actor}}, error:null}) } })
    jest.mocked(claimMerchantAuthorization).mockResolvedValue({ id: randomUUID(), site_id: site, user_id: actor,
      provider:"uber_eats",environment:"production",country:"MX",credential_mode:"platform",encrypted_context:"test",expires_at:"test",status:"claimed" })
    jest.mocked(requireSiteAccess).mockResolvedValue({ role:"owner",supabase:{},userEmail:null,userId:actor })
    jest.mocked(completeMerchantAuthorization).mockResolvedValue({ connection_id: connection })
    const response = await GET(new NextRequest(url, { headers: {cookie:`marketplace_oauth_uber_eats=${state}`} }), parameters)
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(`https://app.example.test/integrations?marketplace_connection=${connection}`)
    expect(response.headers.get("location")).not.toContain(code)
    expect(response.headers.get("location")).not.toContain(state)
    expect(claimMerchantAuthorization).toHaveBeenCalledWith(state,"uber_eats",actor)
  })
})