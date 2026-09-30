import "server-only"

import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { fromStripeMinorAmount } from "@/app/api/stripe/checkout/checkout-payment-guard"
import { postSaleJournalWithClient } from "@/app/accounting/source-posting"
import { findSaleByPaymentIntent, handleStripeSaleRefund, stripePaymentIntentId } from "./handle-stripe-sale-refund"

type RefundClient = Pick<SupabaseClient, "from" | "rpc">

/** Caller must verify the webhook signature before passing the trusted service client. */
export async function recordStripeAccountingRefunds(
  supabase: RefundClient,
  stripe: Pick<Stripe, "refunds">,
  charge: Stripe.Charge,
): Promise<void> {
  const paymentIntentId = stripePaymentIntentId(charge.payment_intent)
  if (!paymentIntentId) return
  const sale = await findSaleByPaymentIntent(supabase, paymentIntentId)
  // Other Stripe products (such as platform billing) do not have a commerce sale.
  if (!sale) return
  if (!sale.site_id || !sale.currency || sale.currency.toUpperCase() !== charge.currency.toUpperCase()) {
    throw new Error("Refund currency or sale scope does not match")
  }

  const refunds: Stripe.Refund[] = []
  const seen = new Set<string>()
  let startingAfter: string | undefined
  do {
    // The charge's embedded refunds list can be truncated. Always read every page.
    const page = await stripe.refunds.list({
      charge: charge.id,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    for (const refund of page.data) {
      if (seen.has(refund.id)) throw new Error("Stripe refund pagination repeated an entry")
      seen.add(refund.id)
      if (refund.status !== "succeeded") continue
      if (stripePaymentIntentId(refund.charge) !== charge.id ||
        refund.currency.toUpperCase() !== charge.currency.toUpperCase() ||
        !Number.isSafeInteger(refund.amount) || refund.amount <= 0 ||
        !Number.isSafeInteger(refund.created) || refund.created <= 0) {
        throw new Error("Invalid successful Stripe refund")
      }
      refunds.push(refund)
    }
    if (!page.has_more) break
    const last = page.data.at(-1)
    if (!last) throw new Error("Stripe refund pagination did not advance")
    startingAfter = last.id
  } while (true)

  for (const refund of refunds.sort((a, b) => a.created - b.created || a.id.localeCompare(b.id))) {
    const { error } = await supabase.rpc("accounting_record_sale_refund", {
      p_sale_id: sale.id,
      p_refund_id: refund.id,
      p_amount: fromStripeMinorAmount(refund.amount, refund.currency),
      p_currency: refund.currency.toUpperCase(),
      p_refunded_at: new Date(refund.created * 1000).toISOString(),
    })
    if (error) throw new Error("Unable to record the Stripe accounting refund")
  }
  const successfulAmount = refunds.reduce((sum, refund) => sum + refund.amount, 0)
  if (refunds.length && Number.isSafeInteger(charge.amount) && charge.amount > 0 && successfulAmount >= charge.amount) {
    await handleStripeSaleRefund(supabase, paymentIntentId)
  }
  // Even idempotent receipt replays must repair a previously failed journal replacement.
  if (refunds.length) await postSaleJournalWithClient(supabase, sale.id, sale.site_id)
}

/** Refund status notifications carry a Refund, not a Charge; reload its trusted parent. */
export async function handleStripeRefundStatusEvent(
  supabase: RefundClient, stripe: Pick<Stripe, 'charges' | 'refunds'>, refund: Stripe.Refund,
) {
  const chargeId = stripePaymentIntentId(refund.charge)
  if (!chargeId) throw new Error('Refund notification is missing its charge')
  const charge = await stripe.charges.retrieve(chargeId)
  if (charge.id !== chargeId) throw new Error('Refund charge did not match')
  // Read the current provider state, not an out-of-order event's status.
  await recordStripeAccountingRefunds(supabase, stripe, charge)
}