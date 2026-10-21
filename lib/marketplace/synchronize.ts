import "server-only"
import { createHash, randomUUID } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { loadMarketplaceIntegration } from "./configuration"
import { fetchOrder, fetchOrderEvents, MarketplaceProviderError } from "./providers"
import { marketplaceMetadata } from "./policy"

/** Read-only at the provider: never repeats an uncertain accept/reject/cancel request. */
export async function synchronizeMarketplaceOrder(integrationId: string, externalOrderId: string) {
  const integration = await loadMarketplaceIntegration(integrationId)
  if (!integration?.config.enabled) throw new Error("Integration is unavailable")
  const { config, credentials } = integration
  try {
    const order = await fetchOrder({
      provider: config.provider, environment: config.environment, country: config.country,
      store_id: config.external_store_id, manual_ready: config.manual_ready, ...credentials,
    }, externalOrderId)
    const metadata = marketplaceMetadata(config.provider, order, config.manual_ready)
    const payload = { ...order, event_kind: "snapshot", metadata: { marketplace: metadata } }
    // A later authoritative observation may restore an earlier value. Content
    // hashes deduplicate event delivery, not distinct provider reads over time.
    const eventKey = `snapshot:${randomUUID()}`
    const database = await createServiceClient(true, { access: 'system' })
    const { error } = await database.rpc("ingest_marketplace_event", {
      p_integration_id: integrationId, p_event_key: eventKey, p_order: payload, p_event_at: null,
    })
    if (error) throw new Error("Provider state could not be committed")
    return { refreshed: true, provider_state: order.status }
  } catch (error) {
    if (error instanceof MarketplaceProviderError && error.code === "not_found" && config.provider === "rappi") {
      const events = await fetchOrderEvents({
        provider: config.provider, environment: config.environment, country: config.country,
        store_id: config.external_store_id, manual_ready: config.manual_ready, ...credentials,
      }, externalOrderId)
      const database = await createServiceClient(true, { access: 'system' })
      let refreshed = false
      for (const event of events.slice(0, 30).reverse()) {
        if (event.kind !== "cancel" && event.kind !== "delivery") continue
        const payload = {
          external_order_id: externalOrderId, external_store_id: config.external_store_id,
          event_kind: event.kind, delivery: event.delivery,
        }
        const eventKey = createHash("sha256").update(`history:${JSON.stringify(event)}`).digest("hex")
        const receipt = await database.rpc("ingest_marketplace_event", {
          p_integration_id: integrationId, p_event_key: eventKey, p_order: payload,
          p_event_at: event.event_at && /(?:Z|[+-]\d{2}:\d{2})$/.test(event.event_at) ? event.event_at : null,
        })
        if (receipt.error) throw new Error("Provider history could not be committed")
        refreshed = refreshed || event.kind === "cancel"
      }
      return {
        refreshed,
        message: "Rappi event history was checked. Only explicit cancellation and courier updates were applied; ambiguous events do not confirm acceptance.",
      }
    }
    throw error
  }
}