import type { MarketplaceActionInput } from "./request"
import type { NormalizedOrder, MarketplaceProvider } from "./providers/types"

export function marketplaceCapabilities(
  provider: MarketplaceProvider,
  state: NormalizedOrder["status"],
  manualReady = false,
) {
  const pending = state === "pending"
  return {
    accept: pending,
    reject: pending,
    ready: provider === "rappi" && manualReady && state === "accepted",
    cancel: provider === "uber_eats" && (state === "accepted" || state === "ready"),
    request_delivery: false,
    cancel_delivery: false,
  }
}

export function marketplaceMetadata(
  provider: MarketplaceProvider,
  order: NormalizedOrder,
  manualReady = false,
) {
  return {
    provider,
    external_order_id: order.external_order_id,
    external_store_id: order.external_store_id,
    display_id: order.display_id,
    state: order.status,
    accept_by: order.accept_by,
    scheduled_at: order.scheduled_at,
    totals_provisional: order.totals_provisional,
    customer: order.customer,
    capabilities: marketplaceCapabilities(provider, order.status, manualReady),
    delivery_mode: order.delivery_mode || "marketplace_managed",
    sync_status: "confirmed",
  }
}

export function confirmedActionState(action: MarketplaceActionInput["action"]): NormalizedOrder["status"] | "rejected" {
  switch (action) {
    case "accept": return "accepted"
    case "ready": return "ready"
    case "reject": return "rejected"
    case "cancel": return "cancelled"
  }
}

export function actionAllowed(metadata: Record<string, unknown>, action: MarketplaceActionInput["action"], now = Date.now()) {
  if (metadata.sync_status === "unknown" || metadata.sync_status === "pending") return false
  if (metadata.state === "scheduled" || metadata.totals_provisional === true) return false
  const capabilities = metadata.capabilities
  if (!capabilities || typeof capabilities !== "object") return false
  if ((capabilities as Record<string, unknown>)[action] !== true) return false
  if ((action === "accept" || action === "reject") && typeof metadata.accept_by === "string") {
    const deadline = Date.parse(metadata.accept_by)
    if (!Number.isFinite(deadline) || deadline <= now) return false
  }
  return true
}