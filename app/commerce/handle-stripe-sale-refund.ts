import { revokeOrderFulfillment } from "@/app/commerce/order-fulfillment-sync"

type QueryClient = {
  from: (table: string) => any
}

export function stripePaymentIntentId(
  value: string | { id?: string } | null | undefined,
): string | null {
  if (!value) return null
  if (typeof value === "string") return value
  return value.id || null
}

export function isFullStripeChargeRefund(charge: {
  refunded?: boolean | null
  amount?: number | null
  amount_refunded?: number | null
}): boolean {
  if (charge.refunded) return true
  const amount = Number(charge.amount) || 0
  const refunded = Number(charge.amount_refunded) || 0
  return amount > 0 && refunded >= amount
}

export async function resolveStripeRefundPaymentIntent(
  object: {
    payment_intent?: string | { id?: string } | null
    charge?: string | { id?: string; payment_intent?: string | { id?: string } | null } | null
  },
  retrieveCharge?: (
    chargeId: string,
  ) => Promise<{ payment_intent?: string | { id?: string } | null } | null>,
): Promise<string | null> {
  const direct = stripePaymentIntentId(object.payment_intent)
  if (direct) return direct

  if (object.charge && typeof object.charge === "object") {
    const expanded = stripePaymentIntentId(object.charge.payment_intent)
    if (expanded) return expanded
  }

  const chargeId =
    typeof object.charge === "string" ? object.charge : object.charge?.id || null
  if (!chargeId || !retrieveCharge) return null

  const charge = await retrieveCharge(chargeId)
  return stripePaymentIntentId(charge?.payment_intent)
}

export async function findSaleByPaymentIntent(supabase: QueryClient, paymentIntentId: string) {
  const { data: byColumn, error: columnError } = await supabase
    .from("sales")
    .select("id, site_id, status, currency, accounting_state")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle()

  if (columnError) throw new Error("Unable to resolve the refunded sale")
  if (byColumn) return byColumn

  const { data: byDetails, error: detailsError } = await supabase
    .from("sales")
    .select("id, site_id, status, currency, accounting_state")
    .eq("payment_details->>stripe_payment_intent_id", paymentIntentId)
    .maybeSingle()

  if (detailsError) throw new Error("Unable to resolve the refunded sale")
  return byDetails
}

export async function handleStripeSaleRefund(
  supabase: QueryClient,
  paymentIntentId: string | null,
  options: { revokeOnly?: boolean } = {},
): Promise<{ saleId?: string; skipped?: string }> {
  if (!paymentIntentId) return { skipped: "missing_payment_intent" }

  const sale = await findSaleByPaymentIntent(supabase, paymentIntentId)

  if (!sale) return { skipped: "sale_not_found" }
  if (!options.revokeOnly && sale.status !== "refunded" && sale.status !== "cancelled") {
    const { error } = await supabase
      .from("sales")
      .update({
        status: "refunded",
        // A refund never invents a receipt by clearing the outstanding balance.
        accounting_state: sale.accounting_state === "unpublished" ? "unpublished" : "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sale.id)
      .eq("site_id", sale.site_id)
    if (error) throw new Error("Unable to mark the sale refunded")
  }

  // Replays must repair fulfillment even when a prior attempt saved the terminal status.
  const { data: order, error: orderError } = await supabase
    .from("sale_orders")
    .select("id")
    .eq("sale_id", sale.id)
    .eq("site_id", sale.site_id)
    .maybeSingle()

  if (orderError) throw new Error("Unable to load the refunded order")
  if (order) {
    await revokeOrderFulfillment(supabase, order.id, { cancelOrder: true })
  }

  return { saleId: sale.id }
}
