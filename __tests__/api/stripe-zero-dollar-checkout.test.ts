/** @jest-environment node */
import { randomUUID } from 'node:crypto'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { handleCheckoutSessionCompleted } from '@/app/api/stripe/webhook/checkout-session-handler'
import { handleBillingStripeEvent } from '@/app/api/stripe/webhook/billing-event-handlers'
import { handleStripeSaleCheckoutCompleted } from '@/app/api/stripe/webhook/sale-checkout-settlement'
import { handleCreditsPurchase } from '@/app/api/stripe/webhook/credit-purchase-settlement'

jest.mock('@/app/api/stripe/webhook/sale-checkout-settlement', () => ({ handleStripeSaleCheckoutCompleted: jest.fn() }))
jest.mock('@/app/api/stripe/webhook/credit-purchase-settlement', () => ({ handleCreditsPurchase: jest.fn() }))
jest.mock('@/app/commerce/stripe-accounting-refunds', () => ({ handleStripeRefundStatusEvent: jest.fn(), recordStripeAccountingRefunds: jest.fn() }))
jest.mock('@/app/commerce/handle-stripe-sale-refund', () => ({ handleStripeSaleRefund: jest.fn(), resolveStripeRefundPaymentIntent: jest.fn() }))

const keys = ['STRIPE_STARTER_PRICE_ID', 'STRIPE_STARTUP_PRICE_ID', 'STRIPE_ENTERPRISE_PRICE_ID',
  'STRIPE_ACCOUNT_ADDON_PRICE_ID', 'STRIPE_STARTER_ANNUAL_PRICE_ID', 'STRIPE_STARTUP_ANNUAL_PRICE_ID',
  'STRIPE_ENTERPRISE_ANNUAL_PRICE_ID', 'STRIPE_ACCOUNT_ADDON_ANNUAL_PRICE_ID',
  'STRIPE_ENTERPRISE_LEGACY_MONTHLY_PRICE_IDS', 'STRIPE_ENTERPRISE_LEGACY_MONTHLY_AMOUNT']
const original = Object.fromEntries(keys.map(key => [key, process.env[key]]))
const priceId = `price_${randomUUID().replaceAll('-', '')}`
const siteId = randomUUID()
const start = Date.UTC(2026, 8, 1) / 1000
const end = Date.UTC(2027, 8, 1) / 1000
const price = { id: priceId, active: true, currency: 'usd', type: 'recurring', billing_scheme: 'per_unit',
  unit_amount: 24840, recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' } }

function harness() {
  const session = { id: 'cs_zero', customer: 'cus_zero', subscription: 'sub_zero', invoice: 'in_zero',
    mode: 'subscription', payment_status: 'no_payment_required', amount_total: 0,
    metadata: { type: 'subscription' } } as unknown as Stripe.Checkout.Session
  const invoice = { id: 'in_zero', customer: 'cus_zero', status: 'paid', amount_paid: 0, amount_due: 0,
    currency: 'usd', billing_reason: 'subscription_create', parent: { subscription_details: { subscription: 'sub_zero' } },
    status_transitions: { paid_at: start }, lines: { has_more: false, data: [{ id: 'il_zero', currency: 'usd',
      quantity: 1, amount: 24840, discount_amounts: [{ amount: 24840, discount: 'di_zero' }],
      pricing: { price_details: { price: priceId }, unit_amount_decimal: '24840' }, period: { start, end },
      parent: { subscription_item_details: { subscription: 'sub_zero', proration: false } } }] } } as unknown as Stripe.Invoice
  const from = jest.fn(() => ({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    single: jest.fn(async () => ({ data: { stripe_customer_id: 'cus_zero', stripe_subscription_id: 'sub_zero' }, error: null })) }))
  let settled = false
  const paymentId = randomUUID()
  const rpc = jest.fn(async name => {
    if (name === 'sync_stripe_subscription_state') return { data: { outcome: 'synced', subscription_id: 'sub_zero' }, error: null }
    if (name !== 'settle_stripe_subscription_invoice') throw new Error('Unexpected RPC')
    const result = { outcome: settled ? 'duplicate' : 'settled', payment_id: paymentId, credits_granted: settled ? 0 : 20 }
    settled = true
    return { data: result, error: null }
  })
  const sdk = {
    checkout: { sessions: { retrieve: jest.fn(async () => session) } },
    invoices: { retrieve: jest.fn(async () => invoice) }, prices: { retrieve: jest.fn(async () => price) },
    subscriptions: { retrieve: jest.fn(async () => ({ id: 'sub_zero', customer: 'cus_zero', status: 'active',
      items: { has_more: false, data: [{ quantity: 1, price, current_period_end: end }] } })) },
    customers: { retrieve: jest.fn(async () => ({ id: 'cus_zero', metadata: { site_id: siteId } })) },
  }
  const params = { stripe: sdk as unknown as Stripe, supabase: { from, rpc } as unknown as SupabaseClient }
  const event = (type: Stripe.Event.Type, object: unknown) => ({ id: `evt_${randomUUID()}`, type, data: { object } }) as Stripe.Event
  return { session, invoice, rpc, sdk,
    checkout: () => handleCheckoutSessionCompleted({ ...params, event: event('checkout.session.completed', { id: 'cs_zero', payment_status: 'paid' }) }),
    paid: () => handleBillingStripeEvent({ ...params, event: event('invoice.paid', { id: 'in_zero', status: 'paid' }) }),
  }
}
beforeEach(() => {
  jest.clearAllMocks()
  keys.forEach(key => { delete process.env[key] })
  process.env.STRIPE_STARTER_ANNUAL_PRICE_ID = priceId
})
afterAll(() => keys.forEach(key => {
  if (original[key] === undefined) delete process.env[key]
  else process.env[key] = original[key]
}))

it.each(['checkout_first', 'invoice_first'])('converges %s fully discounted annual service on one paid invoice identity', async order => {
  const h = harness()
  if (order === 'invoice_first') await h.paid()
  await h.checkout()
  if (order === 'checkout_first') await h.paid()
  await h.checkout()
  const calls = h.rpc.mock.calls.filter(([name]) => name === 'settle_stripe_subscription_invoice')
  expect(calls).toHaveLength(3)
  for (const [, args] of calls as unknown as [string, { p_invoice: unknown }][]) {
    expect(args.p_invoice).toMatchObject({ invoice_id: 'in_zero', status: 'paid', amount: 0,
      payment_intent_id: null, plan: 'engine', billing_interval: 'year', coverage_verified: true })
  }
  // SQL's duplicate result grants no additional credits. Real atomicity has its
  // own offline integration suite; the producer must use one invoice, not session.
  const results = await Promise.all(h.rpc.mock.results.map(result => result.value))
  expect(results.reduce((total, result) => total + (result.data.credits_granted ?? 0), 0)).toBe(20)
  expect(h.sdk.invoices.retrieve).toHaveBeenCalledWith('in_zero', { expand: ['payments'] })
  expect(handleCreditsPurchase).not.toHaveBeenCalled()
  expect(handleStripeSaleCheckoutCompleted).not.toHaveBeenCalled()
})

it.each(['open', 'draft', 'uncollectible', 'void'])('rejects no_payment_required when authoritative invoice is %s despite paid payload', async status => {
  const h = harness()
  h.invoice.status = status as Stripe.Invoice.Status
  await expect(h.checkout()).rejects.toThrow('not paid')
  expect(h.rpc).not.toHaveBeenCalled()
})

it.each(['invoice', 'customer', 'subscription'])('rejects no_payment_required missing %s binding', async field => {
  const h = harness()
  Object.assign(h.session, { [field]: null })
  await expect(h.checkout()).rejects.toThrow('missing')
  expect(h.sdk.invoices.retrieve).not.toHaveBeenCalled()
  expect(h.rpc).not.toHaveBeenCalled()
})

it.each([{ customer: 'cus_other' }, { parent: { subscription_details: { subscription: 'sub_other' } } },
  { status_transitions: { paid_at: null } }, { lines: { has_more: false, data: [] } }])
('rejects no_payment_required with unverifiable paid invoice %#', async overrides => {
  const h = harness()
  Object.assign(h.invoice, overrides)
  await expect(h.checkout()).rejects.toThrow()
  expect(h.rpc).not.toHaveBeenCalled()
})

it.each([{ mode: 'payment' }, { amount_total: 1 }, { amount_total: null }, { payment_status: 'unpaid' }])
('rejects nonzero, unknown or unpaid subscription session %#', async overrides => {
  const h = harness()
  Object.assign(h.session, overrides)
  await expect(h.checkout()).rejects.toThrow('not paid')
  expect(h.sdk.invoices.retrieve).not.toHaveBeenCalled()
  expect(h.rpc).not.toHaveBeenCalled()
})

it.each(['sale', 'sale_order', 'credits_purchase', 'unknown'])('never relaxes %s paid-session checks', async type => {
  const h = harness()
  h.session.metadata = { type }
  await expect(h.checkout()).rejects.toThrow('not paid')
  expect(handleCreditsPurchase).not.toHaveBeenCalled()
  expect(handleStripeSaleCheckoutCompleted).not.toHaveBeenCalled()
  expect(h.sdk.invoices.retrieve).not.toHaveBeenCalled()
  expect(h.rpc).not.toHaveBeenCalled()
})