import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { fromStripeMinorAmount } from "@/app/api/stripe/checkout/checkout-payment-guard"
import {
  handleStripeSaleRefund,
  isFullStripeChargeRefund,
  resolveStripeRefundPaymentIntent,
} from "@/app/commerce/handle-stripe-sale-refund"

type BillingWebhookClient = Pick<SupabaseClient, "from" | "rpc">
type WebhookInvoice = Stripe.Invoice & {
  id: string
  customer?: unknown
  subscription?: unknown
  payment_intent?: unknown
  last_payment_error?: { message?: string }
}

function stripeObjectId(value: unknown): string | null {
  if (typeof value === "string") return value
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === "string" ? id : null
  }
  return null
}

async function siteIdForCustomer(
  stripe: Stripe,
  customerRef: unknown,
): Promise<string | null> {
  const customerId = stripeObjectId(customerRef)
  if (!customerId) return null
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted) return null
  return customer.metadata?.site_id || null
}

async function handleSubscriptionChanged(
  event: Stripe.Event,
  stripe: Stripe,
  supabase: BillingWebhookClient,
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription
  const siteId = await siteIdForCustomer(
    stripe,
    subscription.customer,
  )
  if (!siteId) {
    console.error("Subscription customer has no site_id", subscription.id)
    return
  }

  const plan = subscription.metadata?.plan || "foundry"
  let addonsCount = Number.parseInt(
    subscription.metadata?.addons_count || "0",
    10,
  )
  const addonItem = subscription.items?.data.find(
    (item) => item.price.id === process.env.STRIPE_ACCOUNT_ADDON_PRICE_ID,
  )
  if (addonItem?.quantity !== undefined) {
    addonsCount = addonItem.quantity || 0
  }

  const currentPeriodEnd =
    (subscription as Stripe.Subscription & {
      current_period_end?: number
    }).current_period_end
  const { error } = await supabase.rpc("upsert_billing", {
    p_site_id: siteId,
    p_plan: plan,
    p_stripe_customer_id: subscription.customer,
    p_stripe_subscription_id: subscription.id,
    p_subscription_status: subscription.status,
    p_subscription_current_period_end: currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000).toISOString()
      : null,
    p_auto_renew: true,
  })
  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`)
  }

  const { error: addonsError } = await supabase
    .from("billing")
    .update({ addons_count: addonsCount })
    .eq("site_id", siteId)
  if (addonsError) {
    console.error("Failed to update subscription add-ons", addonsError)
  }
}

async function handlePaidInvoice(
  event: Stripe.Event,
  stripe: Stripe,
  supabase: BillingWebhookClient,
): Promise<void> {
  const payload = event.data.object as WebhookInvoice
  const liveInvoice = await stripe.invoices.retrieve(payload.id)
  if (liveInvoice.status !== "paid") {
    throw new Error(`Stripe invoice ${liveInvoice.id} is not paid`)
  }

  const invoice = { ...payload, ...liveInvoice } as WebhookInvoice
  const subscriptionId = stripeObjectId(invoice.subscription)
  if (!subscriptionId) return
  const siteId = await siteIdForCustomer(stripe, invoice.customer)
  if (!siteId) {
    console.error("Invoice customer has no site_id", invoice.id)
    return
  }

  const transactionId = `stripe_invoice_${invoice.id}`
  const { data: existingPayment, error: duplicateError } = await supabase
    .from("payments")
    .select("id, transaction_id")
    .eq("transaction_id", transactionId)
    .single()
  if (duplicateError && duplicateError.code !== "PGRST116") {
    throw new Error(`Failed to check invoice payment: ${duplicateError.message}`)
  }
  if (existingPayment) return

  const { error: paymentError } = await supabase
    .from("payments")
    .insert({
      site_id: siteId,
      transaction_id: transactionId,
      transaction_type: "subscription",
      amount: fromStripeMinorAmount(
        invoice.amount_paid || 0,
        invoice.currency || "usd",
      ),
      currency: invoice.currency?.toUpperCase() || "USD",
      status: "completed",
      payment_method: "stripe",
      invoice_url: invoice.hosted_invoice_url || invoice.invoice_pdf || null,
      details: {
        stripe_payment_intent_id: invoice.payment_intent,
        stripe_invoice_id: invoice.id,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: invoice.customer,
        billing_reason: invoice.billing_reason,
      },
    })
  if (paymentError) {
    throw new Error(`Failed to record invoice payment: ${paymentError.message}`)
  }

  if (invoice.billing_reason !== "subscription_cycle") return
  const { data: billing, error: billingError } = await supabase
    .from("billing")
    .select("plan, addons_count")
    .eq("site_id", siteId)
    .single()
  if (billingError) {
    throw new Error(`Failed to fetch billing info: ${billingError.message}`)
  }

  const baseCredits =
    billing?.plan === "enterprise"
      ? 500
      : billing?.plan === "foundry"
        ? 100
        : billing?.plan === "engine"
          ? 20
          : 0
  const credits = baseCredits + (billing?.addons_count || 0) * 5
  if (credits > 0) {
    const { error } = await supabase.rpc("add_credits", {
      p_site_id: siteId,
      p_credits: credits,
    })
    if (error) {
      throw new Error(`Failed to add renewal credits: ${error.message}`)
    }
  }
}

async function handleFailedInvoice(
  event: Stripe.Event,
  stripe: Stripe,
  supabase: BillingWebhookClient,
): Promise<void> {
  const invoice = event.data.object as WebhookInvoice
  const subscriptionId = stripeObjectId(invoice.subscription)
  if (!subscriptionId) return
  const siteId = await siteIdForCustomer(stripe, invoice.customer)
  if (!siteId) {
    console.error("Failed invoice customer has no site_id", invoice.id)
    return
  }

  const { error } = await supabase.from("payments").insert({
    site_id: siteId,
    transaction_id: `stripe_invoice_${invoice.id}`,
    transaction_type: "subscription",
    amount: fromStripeMinorAmount(
      invoice.amount_due || 0,
      invoice.currency || "usd",
    ),
    currency: invoice.currency?.toUpperCase() || "USD",
    status: "failed",
    payment_method: "stripe",
    details: {
      stripe_invoice_id: invoice.id,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: invoice.customer,
      failure_reason:
        invoice.last_payment_error?.message || "Payment failed",
    },
  })
  if (error) {
    throw new Error(`Failed to record failed invoice: ${error.message}`)
  }
}

async function handleRefundOrDispute(
  event: Stripe.Event,
  stripe: Stripe,
  supabase: BillingWebhookClient,
): Promise<void> {
  const object = event.data.object as Stripe.Charge
  const paymentIntentId = await resolveStripeRefundPaymentIntent(
    object,
    async (chargeId) => stripe.charges.retrieve(chargeId),
  )
  const isFullRefund =
    event.type === "charge.dispute.created" ||
    isFullStripeChargeRefund(object)
  if (!isFullRefund) return
  await handleStripeSaleRefund(supabase, paymentIntentId)
}

async function handleFailedPaymentIntent(
  event: Stripe.Event,
  supabase: BillingWebhookClient,
): Promise<void> {
  const intent = event.data.object as Stripe.PaymentIntent
  if (
    intent.metadata?.type !== "credits_purchase" ||
    !intent.metadata.site_id
  ) {
    return
  }

  const { error } = await supabase.from("payments").insert({
    site_id: intent.metadata.site_id,
    transaction_id: `stripe_pi_${intent.id}`,
    transaction_type: "credits_purchase",
    amount: fromStripeMinorAmount(intent.amount || 0, intent.currency || "usd"),
    currency: intent.currency?.toUpperCase() || "USD",
    status: "failed",
    payment_method: "stripe",
    details: {
      stripe_payment_intent_id: intent.id,
      credits_requested: Number.parseInt(intent.metadata.credits || "0", 10),
      failure_reason: intent.last_payment_error?.message || "Payment failed",
    },
  })
  if (error) {
    console.error("Failed to record failed credit purchase", error)
  }
}

export async function handleBillingStripeEvent(params: {
  event: Stripe.Event
  stripe: Stripe
  supabase: BillingWebhookClient
}): Promise<boolean> {
  const { event, stripe, supabase } = params
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await handleSubscriptionChanged(event, stripe, supabase)
      return true
    case "invoice.payment_succeeded":
      await handlePaidInvoice(event, stripe, supabase)
      return true
    case "invoice.payment_failed":
      await handleFailedInvoice(event, stripe, supabase)
      return true
    case "charge.refunded":
    case "charge.dispute.created":
      await handleRefundOrDispute(event, stripe, supabase)
      return true
    case "payment_intent.payment_failed":
      await handleFailedPaymentIntent(event, supabase)
      return true
    default:
      return false
  }
}
