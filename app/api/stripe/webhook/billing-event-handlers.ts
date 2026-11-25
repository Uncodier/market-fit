import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import { handleStripeRefundStatusEvent, recordStripeAccountingRefunds } from "@/app/commerce/stripe-accounting-refunds"
import { fromStripeMinorAmount } from "@/app/api/stripe/checkout/checkout-payment-guard"
import {
  handleStripeSaleRefund,
  resolveStripeRefundPaymentIntent,
} from "@/app/commerce/handle-stripe-sale-refund"
import { stripeObjectId, syncStripeSubscription } from "./subscription-billing"
import { settleAutoTopUpIntent } from "../auto-top-up/settlement"
import { settleStripeSubscriptionInvoice } from "./subscription-invoice-settlement"

type BillingWebhookClient = Pick<SupabaseClient, "from" | "rpc">

async function revokeLateRenewalAccess(supabase: BillingWebhookClient, chargeId: string | null) {
  if (!chargeId) throw new Error('Missing reversed charge identity')
  const { data, error } = await supabase.rpc('revoke_stripe_late_renewal_access', { p_charge_id: chargeId })
  if (error || data !== 'revoked') throw new Error('Could not record late renewal reversal')
}

async function handleRefundOrDispute(
  event: Stripe.Event,
  stripe: Stripe,
  supabase: BillingWebhookClient,
): Promise<void> {
  const object = event.data.object as Stripe.Charge
  // A reversal can arrive before invoice settlement. Fence the charge before
  // downstream accounting, even if no local access grant exists yet.
  await revokeLateRenewalAccess(supabase, event.type === 'charge.dispute.created'
    ? stripeObjectId((event.data.object as Stripe.Dispute).charge) : object.id)
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
  if ((event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed" ||
       event.type === "payment_intent.canceled") &&
      (event.data.object as Stripe.PaymentIntent).metadata?.type === "credit_auto_top_up") {
    await settleAutoTopUpIntent(stripe, event.data.object as Stripe.PaymentIntent)
    return true
  }
  switch (event.type) {
    case 'credit_note.created': {
      // A post-payment credit can return the money as customer balance rather
      // than a card refund. The invoice stays paid and the charge stays captured.
      const note = event.data.object as Stripe.CreditNote
      if (note.type !== 'post_payment' || note.status !== 'issued' || !(note.amount > 0)) return true
      const invoiceId = stripeObjectId(note.invoice)
      if (!invoiceId) throw new Error('Missing credited invoice identity')
      const invoice = await stripe.invoices.retrieve(invoiceId, { expand: ['payments'] })
      if (invoice.id !== invoiceId) throw new Error('Credited invoice mismatch')
      if (invoice.billing_reason !== 'subscription_cycle') return true
      // Only a single fully bound intent can ever support this access grant.
      if (invoice.payments?.has_more !== false || invoice.payments.data.length !== 1) return true
      const payment = invoice.payments.data[0]
      const intentId = stripeObjectId(payment.payment.payment_intent)
      if (payment.payment.type !== 'payment_intent' || !intentId || stripeObjectId(payment.invoice) !== invoiceId) return true
      const intent = await stripe.paymentIntents.retrieve(intentId)
      if (intent.id !== intentId || stripeObjectId(intent.customer) !== stripeObjectId(invoice.customer)) throw new Error('Credited payment mismatch')
      if (intent.latest_charge) await revokeLateRenewalAccess(supabase, stripeObjectId(intent.latest_charge))
      return true
    }
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
    case 'charge.refund.updated': {
      const refund = event.data.object as Stripe.Refund
      if (refund.status === 'succeeded') await revokeLateRenewalAccess(supabase, stripeObjectId(refund.charge))
      await handleStripeRefundStatusEvent(supabase, stripe, refund)
      return true
    }
    case "payment_intent.payment_failed":
      await handleFailedPaymentIntent(event, supabase)
      return true
    default:
      return false
  }
}
