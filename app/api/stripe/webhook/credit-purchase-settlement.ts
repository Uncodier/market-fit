import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { fromStripeMinorAmount } from "@/app/api/stripe/checkout/checkout-payment-guard"
import { stripeObjectId } from "./subscription-billing"
import { isFullyDiscountedCreditsCheckout } from "./credit-purchase-discount"

/** Verified webhook + live paid or fully discounted Checkout session. SQL serializes the grant key. */
export async function handleCreditsPurchase(
  supabase: Pick<SupabaseClient, "from" | "rpc">,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const siteId = session.metadata?.site_id
  const rawCredits = session.metadata?.credits
  const credits = Number(rawCredits)
  if (!siteId || !rawCredits || !/^\d+$/.test(rawCredits) ||
      !Number.isSafeInteger(credits) || credits <= 0 ||
      (session.payment_status !== "paid" && !isFullyDiscountedCreditsCheckout(session))) {
    throw new Error("Invalid paid credits purchase")
  }
  const transactionId = `stripe_${session.id}`
  const { data: existingPayment, error: duplicateError } = await supabase.from("payments")
    .select("id, transaction_id, site_id, transaction_type, status, credits")
    .eq("transaction_id", transactionId).single()
  if (duplicateError && duplicateError.code !== "PGRST116") {
    throw new Error(`Failed to check credits payment: ${duplicateError.message}`)
  }
  if (existingPayment) {
    if (existingPayment.site_id !== siteId || existingPayment.transaction_type !== "credits_purchase" ||
        existingPayment.status !== "completed" || Number(existingPayment.credits) !== credits) {
      throw new Error("Conflicting credits payment")
    }
    return
  }
  const details = {
    stripe_payment_intent_id: stripeObjectId(session.payment_intent),
    stripe_session_id: session.id,
    credits_purchased: credits,
    stripe_customer_id: stripeObjectId(session.customer),
  }
  const amount = fromStripeMinorAmount(session.amount_total!, session.currency!)
  const { data, error: creditsError } = await supabase.rpc("grant_purchased_site_credits", {
    p_site_id: siteId,
    p_amount: credits,
    p_idempotency_key: transactionId,
    p_metadata: details,
  })
  if (creditsError) throw new Error(`Failed to add purchased credits: ${creditsError.message}`)
  if (data?.success !== true || !["granted", "duplicate"].includes(data.outcome) ||
      !Number.isFinite(data.new_balance) || !Number.isFinite(data.credits_granted) ||
      data.credits_granted < 0) {
    throw new Error("Invalid purchased credit grant response")
  }
  // If this write fails, the next delivery retries the payment but NOT the grant.
  const { error: paymentError } = await supabase.from("payments").upsert({
    site_id: siteId,
    transaction_id: transactionId,
    transaction_type: "credits_purchase",
    amount,
    currency: session.currency!.toUpperCase(),
    status: "completed",
    payment_method: "stripe",
    details,
    credits,
  }, { onConflict: "transaction_id", ignoreDuplicates: true })
  if (paymentError) throw new Error(`Failed to record credits payment: ${paymentError.message}`)
}