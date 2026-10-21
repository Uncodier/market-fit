import "server-only"
import { createHash } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { loadMarketplaceIntegration } from "./configuration"
import { fetchNewOrders } from "./providers"
import { marketplaceMetadata } from "./policy"
import { synchronizeMarketplaceOrder } from "./synchronize"

/** Bounded provider reads only; dispatch/accept/cancel are never retried by this worker. */
export async function pollMarketplaceStores(deadline: number) {
  const database = await createServiceClient(true, { access: 'system' })
  const { data, error } = await database.rpc("claim_marketplace_poll", { p_limit: 3 })
  if (error || !Array.isArray(data)) throw new Error("Marketplace poll admission unavailable")
  let refreshed = 0
  let unavailable = 0
  for (const candidate of data) {
    if (Date.now() >= deadline) break
    try {
      const integration = await loadMarketplaceIntegration(candidate.integration_id)
      if (!integration?.config.enabled) continue
      const { config, credentials } = integration
      if (config.provider === "rappi") {
        // Exactly one alternating new/SENT list request per leased store.
        const orders = await fetchNewOrders({
          provider: config.provider, environment: config.environment, country: config.country,
          store_id: config.external_store_id, manual_ready: config.manual_ready, ...credentials,
        }, candidate.order_list === "sent" ? "sent" : "new")
        for (const order of orders) {
          if (Date.now() >= deadline) { unavailable++; break }
          const payload = { ...order, metadata: { marketplace: marketplaceMetadata(config.provider, order, config.manual_ready) } }
          const eventKey = createHash("sha256").update(`poll:${JSON.stringify(payload)}`).digest("hex")
          try {
            const receipt = await database.rpc("ingest_marketplace_event", {
              p_integration_id: config.id, p_event_key: eventKey, p_order: payload, p_event_at: null,
            })
            if (receipt.error) throw new Error("Poll import unavailable")
            refreshed++
          } catch { unavailable++ }
        }
      } else {
        const orders = await database.from("sale_orders")
          .select("external_order_id").eq("marketplace_integration_id", config.id)
          .not("status", "in", "(completed,cancelled)").order("marketplace_polled_at", { ascending: true, nullsFirst: true }).limit(3)
        if (orders.error) throw new Error("Poll orders unavailable")
        for (const order of orders.data || []) {
          if (Date.now() >= deadline) break
          if (typeof order.external_order_id !== "string") continue
          try {
            await synchronizeMarketplaceOrder(config.id, order.external_order_id)
            refreshed++
          } catch { unavailable++ }
          finally {
            // Rotate failed orders too: one unavailable order must not starve
            // every other delivery assigned to this store.
            const marked = await database.from("sale_orders").update({ marketplace_polled_at: new Date().toISOString() })
              .eq("marketplace_integration_id", config.id).eq("external_order_id", order.external_order_id)
            if (marked.error) throw new Error("Poll checkpoint unavailable")
          }
        }
      }
    } catch { unavailable++ }
  }
  return { refreshed, unavailable }
}