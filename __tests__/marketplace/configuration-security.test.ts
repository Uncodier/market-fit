/** @jest-environment node */
import { randomBytes, randomUUID } from "node:crypto"
import { encryptMarketplaceCredentials, decryptMarketplaceCredentials } from "@/lib/marketplace/encryption"
import { marketplaceConfigurationSchema } from "@/lib/marketplace/config-types"
import { marketplaceIntegrationDTO, marketplaceWebhookUrl, readIntegrationCredentials, loadMarketplaceIntegration } from "@/lib/marketplace/configuration"
import { createServiceClient } from "@/lib/supabase/server"

jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
const synthetic = () => randomBytes(24).toString("hex")
const config = {
  id: randomUUID(), site_id: randomUUID(), provider: "rappi" as const, environment: "sandbox" as const,
  country: "MX" as const, external_store_id: "store-42", origin_location_id: randomUUID(),
  secret_id: randomUUID(), enabled: true, manual_ready: false, created_by_user_id: randomUUID(),
}

describe("marketplace write-only encryption and configuration", () => {
  let originalKey: string | undefined
  let originalOrigin: string | undefined
  beforeEach(() => {
    originalKey = process.env.ENCRYPTION_KEY
    originalOrigin = process.env.NEXT_PUBLIC_APP_URL
    process.env.ENCRYPTION_KEY = synthetic()
    delete process.env.NEXT_PUBLIC_APP_URL
    jest.clearAllMocks()
  })
  afterEach(() => {
    if (originalKey === undefined) delete process.env.ENCRYPTION_KEY
    else process.env.ENCRYPTION_KEY = originalKey
    if (originalOrigin === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = originalOrigin
  })
  it("round trips authenticated AES256GCM envelopes with random IVs", () => {
    const credentials = { client_id: synthetic(), client_secret: synthetic(), webhook_secret: synthetic() }
    const first = encryptMarketplaceCredentials(credentials)
    const second = encryptMarketplaceCredentials(credentials)
    expect(first).toMatch(/^v1:/)
    expect(first).not.toBe(second)
    expect(decryptMarketplaceCredentials(first)).toEqual(credentials)
    for (const secret of Object.values(credentials)) expect(first).not.toContain(secret)
    const fields = first.split(":")
    for (const index of [1, 2, 3]) {
      const tampered = [...fields]
      const value = Buffer.from(tampered[index], "base64")
      value[0] ^= 1
      tampered[index] = value.toString("base64")
      expect(() => decryptMarketplaceCredentials(tampered.join(":"))).toThrow("Marketplace credentials are unavailable")
    }
    process.env.ENCRYPTION_KEY = synthetic()
    expect(() => decryptMarketplaceCredentials(first)).toThrow("Marketplace credentials are unavailable")
  })
  it("fails closed for missing keys, malformed envelopes and legacy ciphertext", () => {
    const credentials = { client_id: synthetic(), client_secret: synthetic() }
    const encrypted = encryptMarketplaceCredentials(credentials)
    delete process.env.ENCRYPTION_KEY
    expect(() => encryptMarketplaceCredentials(credentials)).toThrow("Marketplace encryption is not configured")
    expect(() => decryptMarketplaceCredentials(encrypted)).toThrow("Marketplace credentials are unavailable")
    process.env.ENCRYPTION_KEY = synthetic()
    for (const invalid of ["", "legacy:blob", encrypted + ":extra", "v1:invalid:invalid:invalid"]) {
      expect(() => decryptMarketplaceCredentials(invalid)).toThrow("Marketplace credentials are unavailable")
    }
  })
  it("allowlists DTO fields without any secret values, ids or ciphertext", () => {
    const sensitive = { client_id: synthetic(), client_secret: synthetic(), webhook_secret: synthetic(), encrypted_value: synthetic() }
    const dto = marketplaceIntegrationDTO({ ...config, ...sensitive }, true, "https://app.example.test/integrations")
    const serialized = JSON.stringify(dto)
    for (const secret of [...Object.values(sensitive), config.secret_id]) expect(serialized).not.toContain(secret)
    expect(dto.has_credentials).toEqual({ client_id: true, client_secret: true, webhook_secret: true })
    expect(dto.webhook_url).toBe("https://app.example.test/api/marketplace/webhooks/rappi")
    expect(marketplaceIntegrationDTO({ ...config, provider: "uber_eats" }, true, "https://app.example.test").has_credentials.webhook_secret).toBe(false)
  })
  it("uses a shared provider callback on the trusted application origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://merchant.example.test/base"
    expect(marketplaceWebhookUrl("uber_eats", "https://request.example.test/path")).toBe("https://merchant.example.test/api/marketplace/webhooks/uber_eats")
    const authenticated = new URL("https://merchant.example.test")
    authenticated.username = synthetic()
    authenticated.password = synthetic()
    process.env.NEXT_PUBLIC_APP_URL = authenticated.href
    expect(() => marketplaceWebhookUrl("rappi", "https://request.example.test")).toThrow("Marketplace callback origin is unavailable")
  })
  it("bounds countries, UUIDs, provider options and rejects arbitrary base URLs", () => {
    const input = { siteId: config.site_id, provider: config.provider, environment: config.environment, country: config.country,
      external_store_id: config.external_store_id, origin_location_id: config.origin_location_id, enabled: true }
    expect(marketplaceConfigurationSchema.parse(input).manual_ready).toBe(false)
    for (const invalid of [{ siteId: "invalid" }, { origin_location_id: "invalid" }, { country: "ZZ" }, { country: "US" },
      { external_store_id: "https://store.example.test" }, { baseURL: "https://provider.example.test" }, { enabled: "true" },
      { provider: "uber_eats", manual_ready: true }, { client_secret: "" }]) {
      expect(marketplaceConfigurationSchema.safeParse({ ...input, ...invalid }).success).toBe(false)
    }
  })
  it("requires the reserved native secret tenant/provider/use-case linkage", async () => {
    const credentials = { client_id: synthetic(), client_secret: synthetic(), webhook_secret: synthetic() }
    const query = { select: jest.fn(), eq: jest.fn(), is: jest.fn(), maybeSingle: jest.fn(async (): Promise<{ data: { encrypted_value: string } | null; error: null }> => ({ data: { encrypted_value: encryptMarketplaceCredentials(credentials) }, error: null })) }
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.is.mockReturnValue(query)
    const service = { from: jest.fn(() => query) }
    expect(await readIntegrationCredentials(service, config)).toEqual(credentials)
    expect(query.eq).toHaveBeenCalledWith("id", config.secret_id)
    expect(query.eq).toHaveBeenCalledWith("site_id", config.site_id)
    expect(query.eq).toHaveBeenCalledWith("provider", config.provider)
    expect(query.eq).toHaveBeenCalledWith("use_case", `marketplace:${config.id}`)
    expect(query.is).toHaveBeenCalledWith("instance_id", null)
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    await expect(readIntegrationCredentials(service, config)).rejects.toThrow("Marketplace credentials are unavailable")
  })
  it("rejects malformed loader identifiers before service access", async () => {
    expect(await loadMarketplaceIntegration("not-a-uuid")).toBeNull()
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})