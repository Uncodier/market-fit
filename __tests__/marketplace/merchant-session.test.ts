/** @jest-environment node */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("@/lib/marketplace/merchant/providers", () => ({ buildAuthorizationUrl: jest.fn(() => "https://auth.example.test/authorize"),
  exchangeAuthorization: jest.fn(), listMerchantStores: jest.fn() }))
import { randomBytes, randomUUID } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { beginMerchantAuthorization, completeMerchantAuthorization, stateHash } from "@/lib/marketplace/merchant/session"
import { decryptMarketplacePayload, encryptMarketplacePayload } from "@/lib/marketplace/encryption"
import { exchangeAuthorization, listMerchantStores } from "@/lib/marketplace/merchant/providers"
import { merchantStartSchema } from "@/lib/marketplace/merchant/types"
import { platformCredentials } from "@/lib/marketplace/merchant/platform"

const environment = { ...process.env }
beforeEach(() => {
  jest.clearAllMocks()
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex")
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test"
  process.env.UBER_EATS_CLIENT_ID = randomUUID()
  process.env.UBER_EATS_CLIENT_SECRET = randomBytes(32).toString("hex")
})
afterEach(() => { process.env = { ...environment } })

describe("merchant authorization context security", () => {
  it("does not copy Makinari's application secret into the tenant OAuth context or API response", async () => {
    const rpc = jest.fn<Promise<{error:null}>,[string,Record<string,unknown>]>(async () => ({ error: null }))
    jest.mocked(createServiceClient).mockResolvedValue({ rpc })
    const result = await beginMerchantAuthorization({ siteId: randomUUID(), provider: "uber_eats", environment: "production", country: "MX" }, randomUUID())
    const arguments_ = rpc.mock.calls[0][1]
    expect(decryptMarketplacePayload(arguments_.p_encrypted_context as string)).toEqual({ verifier: expect.any(String) })
    expect(arguments_.p_state_hash).toBe(stateHash(result.state))
    expect(JSON.stringify(result)).not.toContain(process.env.UBER_EATS_CLIENT_SECRET)
    expect(JSON.stringify(arguments_)).not.toContain(process.env.UBER_EATS_CLIENT_SECRET)
  })
  it("allows advanced custom credentials but prevents overriding the Makinari application", () => {
    const input = { siteId: randomUUID(), provider: "uber_eats", environment: "production", country: "MX",
      client_id: randomUUID(), client_secret: randomBytes(32).toString("hex") }
    expect(merchantStartSchema.safeParse({ ...input, credential_mode: "custom" }).success).toBe(true)
    expect(merchantStartSchema.safeParse({ ...input, credential_mode: "platform" }).success).toBe(false)
  })
  it("keeps sandbox credentials independent and fails closed if they are not configured", () => {
    delete process.env.UBER_EATS_SANDBOX_CLIENT_ID
    delete process.env.UBER_EATS_SANDBOX_CLIENT_SECRET
    expect(() => platformCredentials("uber_eats", "sandbox")).toThrow()
  })
  it("stores merchant tokens encrypted and limits store discovery to the provider response", async () => {
    const token = randomBytes(48).toString("base64url")
    const stores = [{ id: randomUUID(), name: "Authorized restaurant" }]
    jest.mocked(exchangeAuthorization).mockResolvedValue({ merchant_token: token, expires_at: new Date(Date.now() + 3600000).toISOString() })
    jest.mocked(listMerchantStores).mockResolvedValue(stores)
    const connectionId = randomUUID()
    const rpc = jest.fn<Promise<{error:null;data:{connection_id:string}}>,[string,Record<string,unknown>]>(async () => ({ error: null, data: { connection_id: connectionId } }))
    jest.mocked(createServiceClient).mockResolvedValue({ rpc })
    const result = await completeMerchantAuthorization({ id: randomUUID(), site_id: randomUUID(), user_id: randomUUID(),
      provider: "uber_eats", environment: "production", country: "MX", credential_mode: "platform",
      encrypted_context: encryptMarketplacePayload({ verifier: randomBytes(48).toString("base64url") }), status: "claimed", expires_at: new Date(Date.now()+600000).toISOString(),
    }, randomBytes(24).toString("base64url"), randomUUID())
    const arguments_ = rpc.mock.calls[0][1]
    expect(arguments_.p_authorized_stores).toEqual(stores)
    expect(decryptMarketplacePayload(arguments_.p_encrypted_authorization as string)).toEqual({ merchant_token: token })
    expect(JSON.stringify(result)).not.toContain(token)
    expect(JSON.stringify(arguments_)).not.toContain(token)
    expect(JSON.stringify(arguments_)).not.toContain(process.env.UBER_EATS_CLIENT_SECRET)
  })
})