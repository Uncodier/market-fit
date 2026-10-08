import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { handleStripeRefundStatusEvent, recordStripeAccountingRefunds } from "@/app/commerce/stripe-accounting-refunds"
import { fromStripeMinorAmount } from "@/app/api/stripe/checkout/checkout-payment-guard"
import {
  handleStripeSaleRefund,
  resolveStripeRefundPaymentIntent,
} from "@/app/commerce/handle-stripe-sale-refund"
import { stripeObjectId, syncStripeSubscription } from "./subscription-billing"
import { settleStripeSubscriptionInvoice } from "./subscription-invoice-settlement"

type BillingWebhookClient = Pick<SupabaseClient, "from" | "rpc">

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
  if (event.type === "charge.dispute.created") {
    // A dispute blocks fulfillment, but is not evidence of a cash refund.
    await handleStripeSaleRefund(supabase, paymentIntentId, { revokeOnly: true })
    return
  }
  await recordStripeAccountingRefunds(supabase, stripe, object)
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
    case "customer.subscription.deleted": {
      const current = await syncStripeSubscription({
        subscriptionId: (event.data.object as Stripe.Subscription).id,
        stripe,
        supabase,
      })
      // A financial-only settlement while paused/inactive must recover without
      // requiring Stripe to redeliver invoice.paid. Never use the event invoice.
      if (event.type === "customer.subscription.updated" && current.outcome === "synced" &&
          current.subscription.status === "active") {
        const invoiceId = stripeObjectId(current.subscription.latest_invoice)
        if (invoiceId) {
          const invoice = await stripe.invoices.retrieve(invoiceId)
          if (invoice.id !== invoiceId) throw new Error("Invoice ID mismatch")
          if (invoice.status === "paid") await settleStripeSubscriptionInvoice({
            invoiceId, eventId: event.id, stripe, supabase, requirePaid: true,
            expectedCustomerId: current.customerId, expectedSubscriptionId: current.subscription.id,
          })
        }
      }
      return true
    }
    case "invoice.paid":
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
      await settleStripeSubscriptionInvoice({
        invoiceId: stripeObjectId(event.data.object) || "",
        eventId: event.id,
        requirePaid: event.type !== "invoice.payment_failed",
        stripe,
        supabase,
      })
      return true
    case "charge.refunded":
    case "charge.dispute.created":
      await handleRefundOrDispute(event, stripe, supabase)
      return true
    case 'refund.created':
    case 'refund.updated':
    case 'refund.failed':
    case 'charge.refund.updated':
      await handleStripeRefundStatusEvent(supabase, stripe, event.data.object as Stripe.Refund)
      return true
    case "payment_intent.payment_failed":
      await handleFailedPaymentIntent(event, supabase)
      return true
    default:
      return false
  }
}
