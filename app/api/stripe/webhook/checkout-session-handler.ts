import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { fromStripeMinorAmount } from "@/app/api/stripe/checkout/checkout-payment-guard"
import { handleStripeSaleCheckoutCompleted } from "./sale-checkout-settlement"
import { stripeObjectId, syncStripeSubscription } from "./subscription-billing"
import { settleStripeSubscriptionInvoice } from "./subscription-invoice-settlement"

type CheckoutWebhookClient = Pick<SupabaseClient, "from" | "rpc">

async function handleCreditsPurchase(
  supabase: CheckoutWebhookClient,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const siteId = session.metadata?.site_id
  const credits = Number.parseInt(session.metadata?.credits || "0", 10)
  if (!siteId || !credits) {
    console.error("Missing credits purchase metadata", session.metadata)
    return
  }

  const transactionId = `stripe_${session.id}`
  const { data: existingPayment, error: duplicateError } = await supabase
    .from("payments")
    .select("id, transaction_id")
    .eq("transaction_id", transactionId)
    .single()
  if (duplicateError && duplicateError.code !== "PGRST116") {
    throw new Error(`Failed to check credits payment: ${duplicateError.message}`)
  }
  if (existingPayment) return

  const { error: creditsError } = await supabase.rpc("add_credits", {
    p_site_id: siteId,
    p_credits: credits,
  })
  if (creditsError) {
    throw new Error(`Failed to add credits: ${creditsError.message}`)
  }

  const { error: paymentError } = await supabase
    .from("payments")
    .insert({
      site_id: siteId,
      transaction_id: transactionId,
      transaction_type: "credits_purchase",
      amount: fromStripeMinorAmount(
        session.amount_total || 0,
        session.currency || "usd",
      ),
      currency: session.currency?.toUpperCase() || "USD",
      status: "completed",
      payment_method: "stripe",
      details: {
        stripe_payment_intent_id: session.payment_intent,
        stripe_session_id: session.id,
        credits_purchased: credits,
        stripe_customer_id: session.customer,
      },
      credits,
    })
  if (paymentError) {
    throw new Error(`Failed to record credits payment: ${paymentError.message}`)
  }
}

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
  await syncStripeSubscription({
    subscriptionId, stripe, supabase, expectedCustomerId: customerId,
  })
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
  if (session.payment_status !== "paid") {
    throw new Error(`Stripe session ${session.id} is not paid`)
  }

  const type = session.metadata?.type
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
