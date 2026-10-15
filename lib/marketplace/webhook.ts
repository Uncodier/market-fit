import { createHash } from "node:crypto"
import type { MarketplaceProvider, ProviderConfig, ProviderWebhookEvent, NormalizedOrder } from "./providers/types"
import { MarketplaceRequestError, parseMarketplaceJson, readMarketplaceBody } from "./request"

export interface WebhookIntegration {
  id: string
  site_id: string
  manual_ready: boolean
  config: ProviderConfig
}

export interface MarketplaceWebhookDependencies {
  parse(provider: MarketplaceProvider, payload: unknown): ProviderWebhookEvent
  resolve(provider: MarketplaceProvider, storeId: string): Promise<WebhookIntegration[]>
  verify(provider: MarketplaceProvider, raw: string, signature: string | null, config: ProviderConfig): boolean
  normalize(config: ProviderConfig, payload: unknown): ProviderWebhookEvent
  fetchOrder(config: ProviderConfig, orderId: string): Promise<NormalizedOrder>
  persist(integration: WebhookIntegration, event: ProviderWebhookEvent, eventKey: string): Promise<void>
}

/** No receipt is acknowledged until the order/event transaction has committed. */
export async function handleMarketplaceWebhook(
  request: Request,
  provider: MarketplaceProvider,
  dependencies: MarketplaceWebhookDependencies,
) {
  const raw = await readMarketplaceBody(request)
  const payload = parseMarketplaceJson(raw)
  const routing = dependencies.parse(provider, payload)
  // Unrecognized events cannot mutate any records, even without a store selector.
  if (routing.kind === "ignore" && !routing.external_store_id) return
  if (!routing.external_store_id) throw new MarketplaceRequestError("Missing store identifier", 400)
  const integrations = await dependencies.resolve(provider, routing.external_store_id)
  const signature = request.headers.get(provider === "uber_eats" ? "x-uber-signature" : "rappi-signature")
  const matching = integrations.filter(integration => dependencies.verify(provider, raw, signature, integration.config))
  if (matching.length !== 1) throw new MarketplaceRequestError("Invalid webhook authentication", 401)
  const integration = matching[0]
  const event = dependencies.normalize(integration.config, payload)
  if (event.external_store_id !== integration.config.store_id) {
    throw new MarketplaceRequestError("Store mismatch", 403)
  }
  if (event.kind === "ignore") return
  if (!event.external_order_id) throw new MarketplaceRequestError("Missing order identifier", 400)
  if (event.kind === "order" && !event.normalized_order) {
    event.normalized_order = await dependencies.fetchOrder(integration.config, event.external_order_id)
  }
  if (event.normalized_order && event.event_type === "orders.scheduled.notification") {
    event.normalized_order.status = "scheduled"
    event.normalized_order.totals_provisional = true
  }
  if (provider === "uber_eats" && event.kind === "delivery") {
    const order = await dependencies.fetchOrder(integration.config, event.external_order_id)
    if (order.external_store_id !== integration.config.store_id || order.external_order_id !== event.external_order_id) {
      throw new MarketplaceRequestError("Order identity mismatch", 403)
    }
    event.delivery = order.delivery
  }
  if (event.normalized_order && (
    event.normalized_order.external_store_id !== integration.config.store_id ||
    event.normalized_order.external_order_id !== event.external_order_id
  )) {
    throw new MarketplaceRequestError("Order identity mismatch", 403)
  }
  const digest = createHash("sha256").update(raw).digest("hex")
  const eventKey = createHash("sha256").update(
    `${event.kind}:${event.external_order_id}:${event.event_key || digest}`,
  ).digest("hex")
  await dependencies.persist(integration, event, eventKey)
}