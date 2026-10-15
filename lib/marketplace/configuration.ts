import "server-only"
import { createServiceClient } from "@/lib/supabase/server"
import { z } from "zod"
import { decryptMarketplaceCredentials } from "./encryption"
import type { MarketplaceProvider } from "./providers/types"
import type { MarketplaceCredentials, MarketplaceIntegrationConfig, MarketplaceIntegrationDTO } from "./config-types"
import { loadConnection } from "./merchant/connection"
import { uberWebhookSigningKey } from "./merchant/signing-key"

export const MARKETPLACE_CONFIG_COLUMNS = "id,site_id,provider,environment,country,external_store_id,origin_location_id,secret_id,enabled,manual_ready,created_by_user_id,credential_mode,merchant_connection_id,provisioning_status,provider_batch_id"
type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>
export interface LoadedMarketplaceIntegration {
  config: MarketplaceIntegrationConfig
  credentials: MarketplaceCredentials & { webhook_signing_key?: string }
}

export async function readIntegrationCredentials(service: ServiceClient, config: MarketplaceIntegrationConfig): Promise<LoadedMarketplaceIntegration["credentials"]> {
  if (config.merchant_connection_id) {
    const { connection, app } = await loadConnection(config.merchant_connection_id, config.site_id)
    if (connection.provider !== config.provider || connection.environment !== config.environment || connection.country !== config.country ||
      !connection.authorized_stores.some(store => store.id === config.external_store_id)) {
      throw new Error("Merchant authorization does not match the store")
    }
    return { client_id: app.client_id, client_secret: app.client_secret,
      ...(config.provider === "uber_eats" ? { webhook_signing_key: uberWebhookSigningKey({
        credential_mode: connection.credential_mode, environment: connection.environment, client_secret: app.client_secret,
      }) } : {}),
    }
  }
  if (config.credential_mode === "platform") throw new Error("Merchant authorization is missing")
  const { data, error } = await service.from("site_secrets").select("encrypted_value")
    .eq("id", config.secret_id).eq("site_id", config.site_id).eq("provider", config.provider)
    .eq("use_case", `marketplace:${config.id}`).is("instance_id", null).maybeSingle()
  if (error || !data?.encrypted_value) throw new Error("Marketplace credentials are unavailable")
  const credentials = decryptMarketplaceCredentials(data.encrypted_value)
  if (config.provider === "rappi" && !credentials.webhook_secret) throw new Error("Marketplace credentials are unavailable")
  return credentials
}

/** Internal server loader; never serialize its return value to a browser. */
export async function loadMarketplaceIntegration(id: string): Promise<LoadedMarketplaceIntegration | null> {
  if (!z.string().uuid().safeParse(id).success) return null
  const service = await createServiceClient(true)
  const { data, error } = await service.from("marketplace_integrations").select(MARKETPLACE_CONFIG_COLUMNS)
    .eq("id", id).maybeSingle()
  if (error) throw new Error("Marketplace configuration is unavailable")
  if (!data) return null
  const config = data as MarketplaceIntegrationConfig
  return { config, credentials: await readIntegrationCredentials(service, config) }
}

/** Store IDs are untrusted selectors only; ingress must verify signatures before routing. */
export async function findMarketplaceIntegrations(provider: MarketplaceProvider, externalStoreId: string): Promise<LoadedMarketplaceIntegration[]> {
  if (!["rappi", "uber_eats"].includes(provider) || !/^[A-Za-z0-9_-]{1,200}$/.test(externalStoreId)) return []
  const service = await createServiceClient(true)
  const { data, error } = await service.from("marketplace_integrations").select(MARKETPLACE_CONFIG_COLUMNS)
    .eq("provider", provider).eq("external_store_id", externalStoreId).eq("enabled", true)
  if (error) throw new Error("Marketplace configuration is unavailable")
  return Promise.all((data || []).map(async (config: MarketplaceIntegrationConfig) => ({
    config, credentials: await readIntegrationCredentials(service, config),
  })))
}

export function marketplaceWebhookUrl(provider: MarketplaceProvider, requestUrl: string): string {
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || requestUrl)
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password) {
    throw new Error("Marketplace callback origin is unavailable")
  }
  return new URL(`/api/marketplace/webhooks/${provider}`, origin.origin).href
}

/** Explicit allowlist: no secret IDs, ciphertext, credential values or unknown row fields. */
export function marketplaceIntegrationDTO(config: MarketplaceIntegrationConfig, hasSecret: boolean, requestUrl: string): MarketplaceIntegrationDTO {
  return {
    id: config.id, site_id: config.site_id, provider: config.provider, environment: config.environment,
    country: config.country, external_store_id: config.external_store_id, origin_location_id: config.origin_location_id,
    enabled: config.enabled, manual_ready: config.manual_ready === true,
    has_credentials: { client_id: hasSecret, client_secret: hasSecret, webhook_secret: hasSecret && config.provider === "rappi" },
    webhook_url: marketplaceWebhookUrl(config.provider, requestUrl),
    credential_mode: config.credential_mode || "custom",
    provisioning_status: config.provisioning_status || "active",
    merchant_connection_id: config.merchant_connection_id || null,
  }
}