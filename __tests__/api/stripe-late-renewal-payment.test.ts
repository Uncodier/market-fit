import type Stripe from 'stripe'
import { verifyLateRenewalPayment } from '@/app/api/stripe/webhook/late-renewal-payment'
import type { StripeSubscriptionInvoiceInput } from '@/app/api/stripe/webhook/subscription-invoice-settlement'

const start = Date.UTC(2026, 0, 1) / 1000
const end = Date.UTC(2026, 1, 1) / 1000
const ended = start + 10 * 86400
const paid = ended + 86400
const iso = (t: number) => new Date(t * 1000).toISOString()
function fixture() {
  const charge = { id: 'ch_test', payment_intent: 'pi_test', customer: 'cus_test', livemode: false, amount: 9900,
    amount_captured: 9900, currency: 'usd', status: 'succeeded', paid: true, captured: true, disputed: false,
    refunded: false, amount_refunded: 0 }
  const intent = { id: 'pi_test', customer: 'cus_test', latest_charge: charge, status: 'succeeded', amount_received: 9900,
    currency: 'usd', livemode: false }
  const retrieve = jest.fn().mockResolvedValue(intent)
  const payment = { payment: { type: 'payment_intent', payment_intent: intent.id }, status: 'paid', amount_paid: 9900,
    currency: 'usd', livemode: false, invoice: 'in_test' }
  const invoice = { id: 'in_test', customer: 'cus_test', currency: 'usd', billing_reason: 'subscription_cycle',
    livemode: false, status: 'paid', total: 9900, amount_paid: 9900, amount_due: 9900, amount_remaining: 0,
    post_payment_credit_notes_amount: 0, pre_payment_credit_notes_amount: 0,
    status_transitions: { paid_at: paid }, payments: { has_more: false, data: [payment] } }
  const subscription = { id: 'sub_test', customer: 'cus_test', livemode: false, status: 'canceled',
    latest_invoice: 'in_test', ended_at: ended, cancellation_details: { reason: 'payment_failed' } }
  const input = { status: 'paid', plan: 'foundry', coverage_verified: true, billing_interval: 'month',
    subscription_id: 'sub_test', invoice_id: 'in_test', customer_id: 'cus_test', payment_intent_id: 'pi_test',
    period_start: iso(start), period_end: iso(end) }
  const verify = (now = paid + 1) => verifyLateRenewalPayment({ paymentIntents: { retrieve } },
    invoice as unknown as Stripe.Invoice, subscription as unknown as Stripe.Subscription,
    input as StripeSubscriptionInvoiceInput, now * 1000)
  return { verify, retrieve, input, invoice, payment, subscription, charge, intent }
}

test('attests a single captured payment for the already-settled term, not a recurring subscription', async () => {
  const f = fixture()
  await expect(f.verify()).resolves.toEqual({ chargeId: 'ch_test', intentId: 'pi_test', endedAt: iso(ended) })
  expect(f.retrieve).toHaveBeenCalledWith('pi_test', { expand: ['latest_charge'] })
})

test.each([
  ['voluntary cancellation', (f: ReturnType<typeof fixture>) => { f.subscription.cancellation_details.reason = 'cancellation_requested' }],
  ['other invoice', (f: ReturnType<typeof fixture>) => { f.subscription.latest_invoice = 'in_other' }],
  ['unverified period', (f: ReturnType<typeof fixture>) => { f.input.coverage_verified = false }],
  ['not a renewal', (f: ReturnType<typeof fixture>) => { f.invoice.billing_reason = 'subscription_update' }],
  ['paid before cancellation', (f: ReturnType<typeof fixture>) => { f.invoice.status_transitions.paid_at = ended - 1 }],
  ['partial coverage of amount', (f: ReturnType<typeof fixture>) => { f.invoice.amount_due += 1 }],
  ['credit note', (f: ReturnType<typeof fixture>) => { f.invoice.post_payment_credit_notes_amount = 1 }],
  ['split payment', (f: ReturnType<typeof fixture>) => { f.invoice.payments.data.push(f.payment) }],
  ['incomplete listing', (f: ReturnType<typeof fixture>) => { f.invoice.payments.has_more = true }],
  ['foreign invoice payment', (f: ReturnType<typeof fixture>) => { f.payment.invoice = 'in_other' }],
  ['refunded', (f: ReturnType<typeof fixture>) => { f.charge.amount_refunded = 1 }],
  ['disputed', (f: ReturnType<typeof fixture>) => { f.charge.disputed = true }],
  ['foreign intent', (f: ReturnType<typeof fixture>) => { f.intent.customer = 'cus_other' }],
  ['foreign charge', (f: ReturnType<typeof fixture>) => { f.charge.payment_intent = 'pi_other' }],
] as const)('does not attest %s', async (_name, change) => {
  const f = fixture(); change(f); await expect(f.verify()).resolves.toBeNull()
})

test('non-renewable access ends at the exact paid boundary', async () => {
  const f = fixture(); await expect(f.verify(end)).resolves.toBeNull(); expect(f.retrieve).not.toHaveBeenCalled()
})