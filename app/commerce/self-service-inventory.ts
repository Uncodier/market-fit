import type { CheckoutSupabaseClient } from "./checkout-types"

/** Server-only caller must already have authorized this exact site and order. */
export async function applySelfServiceInventoryRelease(params: {
  client: CheckoutSupabaseClient
  siteId: string
  orderId: string
}) {
  const { data, error } = await params.client.rpc("release_self_service_order", {
    p_site_id: params.siteId,
    p_order_id: params.orderId,
  })
  if (error || data?.status !== "completed" || !Array.isArray(data.items)) {
    throw new Error("Unable to atomically release paid self-service order")
  }
  return data.items
}
