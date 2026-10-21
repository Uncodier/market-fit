import "server-only"
import { createServiceClient } from "@/lib/supabase/server"
import { findMarketplaceIntegrations } from "./configuration"
import { fetchOrder, normalizeWebhook, parseWebhook } from "./providers"
import { verifyRappiSignature, verifyUberSignature } from "./signatures"
import { marketplaceMetadata } from "./policy"
import type { MarketplaceWebhookDependencies } from "./webhook"
import { appIdentity } from "./merchant/platform"
import { decryptMarketplacePayload } from "./encryption"

export const marketplaceWebhookDependencies: MarketplaceWebhookDependencies = {
  parse: parseWebhook,
  async resolve(provider, storeId) {
    const matches = await findMarketplaceIntegrations(provider, storeId)
    const database = await createServiceClient(true, { access: 'system' })
    return Promise.all(matches.filter(({ config }) => config.enabled).map(async ({ config, credentials }) => {
      const webhookSecrets: Record<string, string> = {}
      if (config.provider === "rappi" && config.merchant_connection_id) {
        const keys = await database.from("marketplace_provider_webhook_keys").select("event,secret_ciphertext")
          .eq("app_client_id_hash", appIdentity(credentials.client_id)).eq("provider", config.provider)
          .eq("environment", config.environment).is("country", null).is("integration_id", null)
        if (keys.error) throw new Error("Webhook keys unavailable")
        for (const key of keys.data || []) {
          const secret = decryptMarketplacePayload(key.secret_ciphertext)
          if (typeof secret === "string") webhookSecrets[key.event] = secret
        }
      }
      return {
        id: config.id, site_id: config.site_id, manual_ready: config.manual_ready,
        config: {
          provider: config.provider, environment: config.environment, country: config.country,
          store_id: config.external_store_id, manual_ready: config.manual_ready, ...credentials, webhook_secrets: webhookSecrets,
        },
      }
    }))
  },
  verify(provider, raw, signature, config) {
    if (provider === "uber_eats") return verifyUberSignature(raw, signature, config.webhook_signing_key ?? config.client_secret)
    if (config.webhook_secret) return verifyRappiSignature(raw, signature, config.webhook_secret)
    const event = parseWebhook(provider, JSON.parse(raw))
    const registeredEvent = event.kind === "cancel"
      ? event.event_type === "NEW_ORDER_SCHEDULED_CANCELLED" ? event.event_type : "ORDER_EVENT_CANCEL"
      : event.kind === "delivery" && event.event_type !== "ORDER_RT_TRACKING" ? "ORDER_OTHER_EVENT" : event.event_type
    const secret = config.webhook_secrets?.[registeredEvent]
    return Boolean(secret) && verifyRappiSignature(raw, signature, secret || "")
  },
  normalize: normalizeWebhook,
  fetchOrder,
  async persist(integration, event, eventKey) {
    // Caller has verified signature, exact store identity and configured connection.
    const database = await createServiceClient(true, { access: 'system' })
    const order = event.normalized_order
    const payload = order ? {
      ...order,
      metadata: { marketplace: marketplaceMetadata(integration.config.provider, order, integration.manual_ready) },
    } : {
      external_order_id: event.external_order_id,
      external_store_id: integration.config.store_id,
      event_kind: event.kind,
      delivery: event.delivery,
    }
    const { error } = await database.rpc("ingest_marketplace_event", {
      p_integration_id: integration.id,
      p_event_key: eventKey,
      p_order: payload,
      p_event_at: event.event_at && /(?:Z|[+-]\d{2}:\d{2})$/.test(event.event_at) ? event.event_at : null,
    })
    if (error) throw new Error("Marketplace event could not be committed")
  },
}