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

async function findSaleByPaymentIntent(supabase: QueryClient, paymentIntentId: string) {
  const { data: byColumn } = await supabase
    .from("sales")
    .select("id, site_id, status")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle()

  if (byColumn) return byColumn

  const { data: byDetails } = await supabase
    .from("sales")
    .select("id, site_id, status")
    .eq("payment_details->>stripe_payment_intent_id", paymentIntentId)
    .maybeSingle()

  return byDetails
}

export async function handleStripeSaleRefund(
  supabase: QueryClient,
  paymentIntentId: string | null,
): Promise<{ saleId?: string; skipped?: string }> {
  if (!paymentIntentId) return { skipped: "missing_payment_intent" }

  const sale = await findSaleByPaymentIntent(supabase, paymentIntentId)

  if (!sale) return { skipped: "sale_not_found" }
  if (sale.status === "refunded" || sale.status === "cancelled") {
    return { skipped: "already_terminal", saleId: sale.id }
  }

  await supabase
    .from("sales")
    .update({ status: "refunded", amount_due: 0 })
    .eq("id", sale.id)

  const { data: order } = await supabase
    .from("sale_orders")
    .select("id")
    .eq("sale_id", sale.id)
    .maybeSingle()

  if (order) {
    await revokeOrderFulfillment(supabase, order.id, { cancelOrder: true })
  }

  return { saleId: sale.id }
}
