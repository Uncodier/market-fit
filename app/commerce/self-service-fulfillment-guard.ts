import "server-only"
import { isSelfServiceOrder, isPersistedSelfServiceSalePaid } from "./self-service-lifecycle"
import type { CheckoutSupabaseClient } from "./checkout-types"

/** Operational controls may cancel, but cannot start/complete unpaid kiosk work. */
export async function assertSelfServiceFulfillmentPaid(
  client: CheckoutSupabaseClient, siteId: string, orderId: string, nextStatus: string,
) {
  if (["draft", "pending", "cancelled"].includes(nextStatus)) return
  const { data: order, error } = await client.from("sale_orders")
    .select("id, sale_id, status, items").eq("site_id", siteId).eq("id", orderId).maybeSingle()
  if (error || !order) throw new Error("Unable to verify order payment.")
  if (!isSelfServiceOrder(order)) return
  const { data: sale, error: saleError } = await client.from("sales")
    .select("status, amount_due").eq("site_id", siteId).eq("id", order.sale_id).maybeSingle()
  if (saleError || order.status === "cancelled" || !isPersistedSelfServiceSalePaid(sale)) {
    throw new Error("Collect payment before preparing or completing this self-service order.")
  }
}