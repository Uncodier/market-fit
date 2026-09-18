import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { fromStripeMinorAmount } from "@/app/api/stripe/checkout/checkout-payment-guard"
import { handleStripeSaleCheckoutCompleted } from "./sale-checkout-settlement"

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
): Promise<void> {
  const siteId = session.metadata?.site_id
  const plan = session.metadata?.plan
  if (!siteId || !plan) {
    console.error("Missing subscription checkout metadata", session.metadata)
    return
  }

  const transactionId = `stripe_${session.id}`
  const { data: existingPayment, error: duplicateError } = await supabase
    .from("payments")
    .select("id, transaction_id")
    .eq("transaction_id", transactionId)
    .single()
  if (duplicateError && duplicateError.code !== "PGRST116") {
    throw new Error(
      `Failed to check subscription payment: ${duplicateError.message}`,
    )
  }
  if (existingPayment) return

  const addonsCount = Number.parseInt(
    session.metadata?.addons_count || "0",
    10,
  )
  const { error: billingError } = await supabase.rpc("upsert_billing", {
    p_site_id: siteId,
    p_plan: plan,
    p_stripe_customer_id: session.customer,
    p_stripe_subscription_id: session.subscription,
    p_subscription_status: "active",
    p_auto_renew: true,
  })
  if (billingError) {
    throw new Error(`Failed to update subscription: ${billingError.message}`)
  }

  if (addonsCount > 0) {
    const { error } = await supabase
      .from("billing")
      .update({ addons_count: addonsCount })
      .eq("site_id", siteId)
    if (error) {
      console.error("Failed to update subscription add-ons", error)
    }
  }

  const { error: paymentError } = await supabase
    .from("payments")
    .insert({
      site_id: siteId,
      transaction_id: transactionId,
      transaction_type: "subscription",
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
        stripe_subscription_id: session.subscription,
        stripe_customer_id: session.customer,
        plan,
      },
    })
  if (paymentError) {
    throw new Error(
      `Failed to record subscription payment: ${paymentError.message}`,
    )
  }

  const baseCredits =
    plan === "enterprise"
      ? 500
      : plan === "foundry"
        ? 100
        : plan === "engine"
          ? 20
          : 0
  const creditsToGrant = baseCredits + addonsCount * 5
  if (creditsToGrant > 0) {
    const { error } = await supabase.rpc("add_credits", {
      p_site_id: siteId,
      p_credits: creditsToGrant,
    })
    if (error) {
      throw new Error(
        `Failed to add subscription credits: ${error.message}`,
      )
    }
  }
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
    await handleInitialSubscription(params.supabase, session)
    return
  }

  console.log(
    "Checkout session has no recognized metadata type",
    session.metadata,
  )
}
