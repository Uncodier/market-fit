import type Stripe from 'stripe'
import { stripeObjectId, stripeTimestampIso } from './subscription-billing'
import type { StripeSubscriptionInvoiceInput } from './subscription-invoice-settlement'

/** Supplement (never replace) canonical full-period price and settlement verification. */
export async function verifyLateRenewalPayment(
  stripe: { paymentIntents: Pick<Stripe['paymentIntents'], 'retrieve'> },
  invoice: Stripe.Invoice, subscription: Stripe.Subscription, input: StripeSubscriptionInvoiceInput,
  now = Date.now(),
) {
  const ended = subscription.ended_at
  const paid = invoice.status_transitions?.paid_at
  if (subscription.status !== 'canceled' || subscription.cancellation_details?.reason !== 'payment_failed' ||
      stripeObjectId(subscription.latest_invoice) !== invoice.id || !ended || !paid || ended > paid ||
      subscription.id !== input.subscription_id || stripeObjectId(subscription.customer) !== input.customer_id ||
      invoice.id !== input.invoice_id || stripeObjectId(invoice.customer) !== input.customer_id ||
      input.status !== 'paid' || !input.coverage_verified || input.billing_interval !== 'month' ||
      input.plan === 'commission' || invoice.billing_reason !== 'subscription_cycle' || invoice.status !== 'paid' ||
      !input.period_start || !input.period_end || !(Date.parse(input.period_start) <= ended * 1000 &&
      paid * 1000 <= now && now < Date.parse(input.period_end))) return null

  const amount = invoice.amount_paid
  if (!Number.isSafeInteger(amount) || amount <= 0 || invoice.currency !== 'usd' || invoice.total !== amount ||
      invoice.amount_due !== amount || invoice.amount_remaining !== 0 || invoice.post_payment_credit_notes_amount !== 0 ||
      invoice.pre_payment_credit_notes_amount !== 0 || invoice.payments?.has_more !== false ||
      invoice.payments.data.length !== 1 || subscription.livemode !== invoice.livemode) return null

  const payment = invoice.payments.data[0]
  const intentId = stripeObjectId(payment.payment.payment_intent)
  if (!intentId || payment.payment.type !== 'payment_intent' || payment.status !== 'paid' ||
      payment.amount_paid !== amount || payment.currency !== invoice.currency || payment.livemode !== invoice.livemode ||
      stripeObjectId(payment.invoice) !== invoice.id || intentId !== input.payment_intent_id) return null

  const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ['latest_charge'] })
  const charge = intent.latest_charge
  if (!charge || typeof charge === 'string') throw new Error('Late renewal charge was not expanded')
  if (intent.id !== intentId || stripeObjectId(intent.customer) !== input.customer_id || intent.status !== 'succeeded' ||
      intent.amount_received !== amount || intent.currency !== invoice.currency || intent.livemode !== invoice.livemode ||
      stripeObjectId(charge.payment_intent) !== intentId || stripeObjectId(charge.customer) !== input.customer_id ||
      charge.livemode !== invoice.livemode || charge.amount !== amount || charge.amount_captured !== amount ||
      charge.currency !== invoice.currency || charge.status !== 'succeeded' || !charge.paid || !charge.captured ||
      charge.disputed !== false || charge.refunded !== false || charge.amount_refunded !== 0) return null

  return { chargeId: charge.id, intentId, endedAt: stripeTimestampIso(ended)! }
}