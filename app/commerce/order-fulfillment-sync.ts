import { processPostPaymentFulfillment } from "@/app/commerce/post-payment"
import { grantFromOrder, revokeFromOrder } from "@/app/commerce/entitlements"
import { restockOrderInventory } from "@/app/commerce/restock-order-inventory"

const TERMINAL_SALE_STATUSES = new Set(["cancelled", "refunded"])

export function shouldFulfillPaidSale(
  previousStatus: string | null | undefined,
  nextStatus: string,
  amountDue: number,
): boolean {
  if (nextStatus !== "completed") return false
  if (amountDue > 0) return false
  if (!previousStatus || previousStatus === "completed") return false
  return !TERMINAL_SALE_STATUSES.has(previousStatus)
}

export function shouldRevokeSale(
  previousStatus: string | null | undefined,
  nextStatus: string,
): boolean {
  if (nextStatus !== "cancelled" && nextStatus !== "refunded") return false
  if (!previousStatus) return true
  return !TERMINAL_SALE_STATUSES.has(previousStatus)
}

type QueryClient = {
  from: (table: string) => any
}

export async function fulfillLinkedOrderAfterPayment(params: {
  supabase: QueryClient
  siteId: string
  saleId: string
  leadId?: string | null
  userId?: string | null
}): Promise<void> {
  const { data: order } = await params.supabase
    .from("sale_orders")
    .select("id, status")
    .eq("sale_id", params.saleId)
    .eq("site_id", params.siteId)
    .maybeSingle()

  if (!order || order.status === "cancelled") return

  if (order.status === "pending") {
    await params.supabase
      .from("sale_orders")
      .update({ status: "completed" })
      .eq("id", order.id)

    await processPostPaymentFulfillment(
      order.id,
      params.siteId,
      params.saleId,
      params.leadId || undefined,
      params.userId || "",
    )
    return
  }

  // Sent / already completed: tickets may still be missing (e.g. pay after send).
  await grantFromOrder(order.id, true)
}

export async function revokeOrderFulfillment(
  supabase: QueryClient,
  orderId: string,
  options?: { cancelOrder?: boolean; previousStatus?: string | null },
): Promise<void> {
  const { data: order } = await supabase
    .from("sale_orders")
    .select("id, status, site_id, origin_location_id, items, sale_id")
    .eq("id", orderId)
    .maybeSingle()

  if (!order) return

  const priorStatus = options?.previousStatus ?? order.status
  const alreadyCancelled = priorStatus === "cancelled"

  if (options?.cancelOrder && !alreadyCancelled) {
    await supabase
      .from("sale_orders")
      .update({ status: "cancelled" })
      .eq("id", orderId)
  }

  await supabase
    .from("sale_order_items")
    .update({ status: "cancelled" })
    .eq("sale_order_id", orderId)

  await revokeFromOrder(orderId, true)

  const { data: items } = await supabase
    .from("sale_order_items")
    .select("id")
    .eq("sale_order_id", orderId)

  if (items && items.length > 0) {
    await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .in(
        "sale_order_item_id",
        items.map((item: { id: string }) => item.id),
      )
  }

  if (!alreadyCancelled) {
    try {
      let saleAlreadyPaid = false
      if (priorStatus === "pending" && order.sale_id) {
        const { data: sale } = await supabase
          .from("sales")
          .select("status, amount_due")
          .eq("id", order.sale_id)
          .maybeSingle()
        saleAlreadyPaid =
          Boolean(sale) &&
          sale.status !== "pending" &&
          sale.status !== "cancelled" &&
          Number(sale.amount_due) === 0
      }

      await restockOrderInventory(supabase, {
        ...order,
        status: priorStatus,
        saleAlreadyPaid,
      })
    } catch (error) {
      console.error("Failed to restock inventory for order:", orderId, error)
    }
  }
}
