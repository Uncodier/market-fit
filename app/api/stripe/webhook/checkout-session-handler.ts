import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { handleStripeSaleCheckoutCompleted } from "./sale-checkout-settlement"
import { stripeObjectId } from "./subscription-billing"
import { settleStripeSubscriptionInvoice } from "./subscription-invoice-settlement"
import { handleCreditsPurchase } from "./credit-purchase-settlement"
import { settleAutoTopUpSetup } from "../auto-top-up/setup/settlement"
import { isFullyDiscountedCreditsCheckout } from "./credit-purchase-discount"

type CheckoutWebhookClient = Pick<SupabaseClient, "from" | "rpc">

async function handleInitialSubscription(
  supabase: CheckoutWebhookClient,
  session: Stripe.Checkout.Session,
  stripe: Stripe,
  eventId: string,
): Promise<void> {
  const subscriptionId = stripeObjectId(session.subscription)
  const invoiceId = stripeObjectId(session.invoice)
  const customerId = stripeObjectId(session.customer)
  if (!subscriptionId || !invoiceId || !customerId) {
    throw new Error("Subscription checkout is missing invoice, subscription, or customer")
  }
  // Settlement owns invoice-aware status sync. A separate lifecycle sync here
  // would allow a delayed checkout duplicate to write stale same-ID status.
  // Checkout and invoice webhooks share one invoice-keyed payment/credit transaction.
  await settleStripeSubscriptionInvoice({
    invoiceId, stripe, supabase, eventId, requirePaid: true,
    expectedCustomerId: customerId, expectedSubscriptionId: subscriptionId,
  })
}

export async function handleCheckoutSessionCompleted(params: {
  event: Stripe.Event
  stripe: Stripe
  supabase: CheckoutWebhookClient
}): Promise<void> {
  const payloadSession = params.event.data.object as Stripe.Checkout.Session
  const session = await params.stripe.checkout.sessions.retrieve(
    payloadSession.id,
  )
  const type = session.metadata?.type
  if (type === "credit_auto_top_up_setup" && session.mode === "setup") {
    await settleAutoTopUpSetup(params.stripe, session)
    return
  }
  // Only subscription invoices can authoritatively prove a fully discounted
  // service. The initial handler still retrieves and verifies a PAID invoice;
  // A zero-cost credit purchase needs a complete, verified 100% discounted
  // Checkout session; the payment mode doesn't create a PaymentIntent for it.
  const zeroSubscription = type === "subscription" && session.mode === "subscription" &&
    session.payment_status === "no_payment_required" && session.amount_total === 0
  const zeroCredits = type === "credits_purchase" && isFullyDiscountedCreditsCheckout(session)
  if (session.payment_status !== "paid" && !zeroSubscription && !zeroCredits) {
    throw new Error(`Stripe session ${session.id} is not paid`)
  }

  if (type === "sale" || type === "sale_order") {
    const settlement = await handleStripeSaleCheckoutCompleted({
      supabase: params.supabase,
      stripe: params.stripe,
      session,
    })
    console.log("Stripe sale checkout processed", {
      sessionId: session.id,
      ...settlement,
    })
    return
  }
  if (type === "credits_purchase") {
    await handleCreditsPurchase(params.supabase, session)
    return
  }
  if (type === "subscription") {
    await handleInitialSubscription(params.supabase, session, params.stripe, params.event.id)
    return
  }

  console.log(
    "Checkout session has no recognized metadata type",
    session.metadata,
  )
}
