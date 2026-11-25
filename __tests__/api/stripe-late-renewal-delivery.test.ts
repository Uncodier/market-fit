import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { handleBillingStripeEvent } from '@/app/api/stripe/webhook/billing-event-handlers'
import { settleStripeSubscriptionInvoice } from '@/app/api/stripe/webhook/subscription-invoice-settlement'
import { retrieveStripeSubscription, syncRetrievedStripeSubscription } from '@/app/api/stripe/webhook/subscription-billing'
import { verifiedInvoiceEntitlements } from '@/app/api/stripe/webhook/subscription-invoice-entitlements'
import { verifyLateRenewalPayment } from '@/app/api/stripe/webhook/late-renewal-payment'

jest.mock('@/app/api/stripe/webhook/subscription-billing', () => ({
  ...jest.requireActual('@/app/api/stripe/webhook/subscription-billing'),
  retrieveStripeSubscription: jest.fn(), syncRetrievedStripeSubscription: jest.fn(),
}))
jest.mock('@/app/api/stripe/webhook/subscription-invoice-entitlements')
jest.mock('@/app/api/stripe/webhook/late-renewal-payment')
jest.mock('@/app/commerce/stripe-accounting-refunds', () => ({ recordStripeAccountingRefunds: jest.fn(), handleStripeRefundStatusEvent: jest.fn() }))
jest.mock('@/app/commerce/handle-stripe-sale-refund', () => ({ resolveStripeRefundPaymentIntent: jest.fn(), handleStripeSaleRefund: jest.fn() }))

const invoice = { id: 'in_test', customer: 'cus_test', subscription: 'sub_test', payment_intent: 'pi_test', status: 'paid',
  currency: 'usd', amount_paid: 9900, billing_reason: 'subscription_cycle', status_transitions: { paid_at: 1800000000 } }
const stripe = { invoices: { retrieve: jest.fn().mockResolvedValue(invoice) } } as unknown as Stripe
const rpc = jest.fn()
const supabase = { rpc } as unknown as SupabaseClient
const settle = () => settleStripeSubscriptionInvoice({ invoiceId: invoice.id, stripe, supabase, requirePaid: true })
beforeEach(() => {
  rpc.mockReset()
  jest.mocked(retrieveStripeSubscription).mockResolvedValue({ siteId: 'site_test', subscription: { status: 'canceled' },
    plan: null, addonsCount: 0, billingInterval: null } as Awaited<ReturnType<typeof retrieveStripeSubscription>>)
  jest.mocked(syncRetrievedStripeSubscription).mockResolvedValue({ outcome: 'synced' } as Awaited<ReturnType<typeof syncRetrievedStripeSubscription>>)
  jest.mocked(verifiedInvoiceEntitlements).mockResolvedValue({ plan: 'foundry', addonsCount: 0, coverage_verified: true,
    billing_interval: 'month', period_start: '2026-11-01T12:00:00Z', period_end: '2026-12-01T12:00:00Z' })
  jest.mocked(verifyLateRenewalPayment).mockResolvedValue({ intentId: 'pi_test', chargeId: 'ch_test', endedAt: '2026-11-20T12:00:00Z' })
})

test('an already-settled invoice recovers access after an interrupted grant without crediting the payment twice', async () => {
  const duplicate = { data: { outcome: 'duplicate', payment_id: 'p_test', credits_granted: 0 } }
  rpc.mockResolvedValueOnce(duplicate).mockResolvedValueOnce({ error: { message: 'temporary' } })
    .mockResolvedValueOnce(duplicate).mockResolvedValueOnce({ data: 'granted' })
  await expect(settle()).rejects.toThrow('late renewal access')
  await expect(settle()).resolves.toMatchObject({ outcome: 'duplicate', credits_granted: 0, late_renewal_access: 'granted' })
  expect(rpc.mock.calls.map(([name]) => name)).toEqual(Array(2).fill(['settle_stripe_subscription_invoice','record_stripe_late_renewal_access']).flat())
  expect(rpc.mock.calls[3][1].p_evidence).toMatchObject({ plan: 'foundry', site_id: 'site_test', invoice_id: 'in_test',
    customer_id: 'cus_test', subscription_id: 'sub_test', payment_intent_id: 'pi_test', charge_id: 'ch_test',
    cancellation_reason: 'payment_failed', amount_paid: 9900, currency: 'USD' })
})

test.each([
  ['charge.refunded', { id: 'ch_test', amount_refunded: 200 }],
  ['charge.dispute.created', { id: 'dp_test', charge: 'ch_test' }],
  ['refund.updated', { id: 're_test', charge: 'ch_test', status: 'succeeded' }],
] as const)('records the charge fence for %s, including a reversal received first', async (type, object) => {
  rpc.mockResolvedValue({ data: 'revoked' })
  const event = { type, data: { object } } as unknown as Stripe.Event
  await expect(handleBillingStripeEvent({ event, stripe, supabase })).resolves.toBe(true)
  expect(rpc).toHaveBeenCalledWith('revoke_stripe_late_renewal_access', { p_charge_id: 'ch_test' })
  rpc.mockResolvedValue({ error: {} })
  await expect(handleBillingStripeEvent({ event, stripe, supabase })).rejects.toThrow('late renewal reversal')
})

test('a post-payment credit note to customer balance fences the same charge without a refund event', async () => {
  const provider = { invoices: { retrieve: jest.fn().mockResolvedValue({ ...invoice,
    payments: { has_more: false, data: [{ invoice: invoice.id, payment: { type: 'payment_intent', payment_intent: 'pi_test' } }] } }) },
    paymentIntents: { retrieve: jest.fn().mockResolvedValue({ id: 'pi_test', customer: invoice.customer, latest_charge: 'ch_test' }) } }
  rpc.mockResolvedValue({ data: 'revoked' })
  const event = { type: 'credit_note.created', data: { object: { type: 'post_payment', amount: 100,
    status: 'issued', invoice: invoice.id } } } as unknown as Stripe.Event
  await expect(handleBillingStripeEvent({ event, stripe: provider as unknown as Stripe, supabase })).resolves.toBe(true)
  expect(rpc).toHaveBeenCalledWith('revoke_stripe_late_renewal_access', { p_charge_id: 'ch_test' })
})