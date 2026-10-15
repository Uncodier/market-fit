/** @jest-environment node */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/marketplace/merchant/connection", () => ({ loadConnection: jest.fn() }))
import { randomBytes, randomUUID } from "node:crypto"
import { loadConnection } from "@/lib/marketplace/merchant/connection"
import { readIntegrationCredentials, marketplaceIntegrationDTO } from "@/lib/marketplace/configuration"
import { encryptMarketplacePayload } from "@/lib/marketplace/encryption"
import type { MarketplaceIntegrationConfig } from "@/lib/marketplace/config-types"

const original = { ...process.env }
afterEach(() => { process.env = { ...original }; jest.clearAllMocks() })

it("loads the platform signing key into server-only credentials without exposing or persisting it", async () => {
  const signingKey = randomBytes(32).toString("hex"), oauthSecret = randomBytes(32).toString("hex")
  process.env.UBER_EATS_WEBHOOK_SIGNING_KEY = signingKey
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex")
  const config: MarketplaceIntegrationConfig = { id: randomUUID(), site_id: randomUUID(), provider: "uber_eats",
    environment: "production", country: "MX", external_store_id: "store-1", origin_location_id: randomUUID(),
    secret_id: null, credential_mode: "platform", merchant_connection_id: randomUUID(), enabled: true,
    manual_ready: false, created_by_user_id: randomUUID() }
  const app = { provider: "uber_eats" as const, environment: "production" as const, country: "MX", client_id: randomUUID(), client_secret: oauthSecret,
    redirect_uri: "https://app.example.test/callback", webhook_url: "https://app.example.test/webhook" }
  const connection = { id: config.merchant_connection_id!, site_id: config.site_id, provider: config.provider, environment: config.environment,
    country: config.country, credential_mode: "platform" as const, app_client_id_hash: randomBytes(32).toString("hex"),
    encrypted_authorization: encryptMarketplacePayload({ merchant_token: randomBytes(32).toString("hex") }), token_expires_at: null,
    authorized_stores: [{ id: config.external_store_id, name: "Kitchen" }], status: "authorized" as const }
  jest.mocked(loadConnection).mockResolvedValue({ connection, app, merchantToken: randomBytes(32).toString("hex") })
  const service = { from: jest.fn() }
  expect(await readIntegrationCredentials(service, config)).toEqual({ client_id: app.client_id, client_secret: oauthSecret, webhook_signing_key: signingKey })
  const row = { ...config, webhook_signing_key: signingKey, client_secret: oauthSecret }
  const serialized = JSON.stringify(marketplaceIntegrationDTO(row, true, "https://app.example.test"))
  expect(serialized).not.toContain(signingKey)
  expect(serialized).not.toContain(oauthSecret)
  expect(connection.encrypted_authorization).not.toContain(signingKey)
  expect(service.from).not.toHaveBeenCalled()
  delete process.env.UBER_EATS_WEBHOOK_SIGNING_KEY
  expect((await readIntegrationCredentials(service, config)).webhook_signing_key).toBe("")
})