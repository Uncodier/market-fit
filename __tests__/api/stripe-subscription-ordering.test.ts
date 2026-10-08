/** @jest-environment node */
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { syncStripeSubscription } from '@/app/api/stripe/webhook/subscription-billing'
import { settleStripeSubscriptionInvoice } from '@/app/api/stripe/webhook/subscription-invoice-settlement'
import { handleBillingStripeEvent } from '@/app/api/stripe/webhook/billing-event-handlers'

jest.mock('@/app/commerce/stripe-accounting-refunds', () => ({
  handleStripeRefundStatusEvent: jest.fn(), recordStripeAccountingRefunds: jest.fn(),
}))
jest.mock('@/app/commerce/handle-stripe-sale-refund', () => ({
  handleStripeSaleRefund: jest.fn(), resolveStripeRefundPaymentIntent: jest.fn(),
}))

const siteId = randomUUID()
const customerId = 'cus_ordering'
const start = Date.UTC(2026, 0, 15) / 1000
const end = Date.UTC(2027, 0, 15) / 1000
const price = { id: 'price_ordering', active: true, currency: 'usd', type: 'recurring',
  billing_scheme: 'per_unit', unit_amount: 24840,
  recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' } } as Stripe.Price
const priceEnv = process.env.STRIPE_STARTER_ANNUAL_PRICE_ID

function subscription(id = 'sub_current', status = 'active', extra = {}): Stripe.Subscription {
  return { id, customer: customerId, status, start_date: start, ended_at: null,
    cancel_at_period_end: false, cancel_at: null,
    items: { has_more: false, data: [{ price, quantity: 1, current_period_end: end }] },
    ...extra } as Stripe.Subscription
}
function invoice(subscriptionId = 'sub_current', extra = {}): Stripe.Invoice {
  return { id: 'in_ordering', customer: customerId, status: 'paid', currency: 'usd',
    amount_paid: 19872, amount_due: 19872, billing_reason: 'subscription_cycle',
    parent: { subscription_details: { subscription: subscriptionId } },
    status_transitions: { paid_at: start }, lines: { has_more: false, data: [{ id: 'il_ordering',
      quantity: 1, amount: 24840, currency: 'usd', period: { start, end },
      discountable: true, discount_amounts: [{ amount: 4968, discount: 'di_ordering' }],
      parent: { subscription_item_details: { subscription: subscriptionId, proration: false } },
      pricing: { price_details: { price: price.id } },
    }] }, ...extra } as Stripe.Invoice
}
function response<T>(value: T): Stripe.Response<T> {
  return Object.assign(value as T & object, { lastResponse: { headers: {}, requestId: 'offline', statusCode: 200 } })
}
function harness() {
  const order: string[] = []
  const stripeTransport = jest.fn(async () => { throw new Error('Unexpected Stripe network') })
  const stripe = new Stripe(randomBytes(24).toString('hex'), {
    httpClient: Stripe.createFetchHttpClient(stripeTransport), maxNetworkRetries: 0,
  })
  const subscriptions = jest.spyOn(stripe.subscriptions, 'retrieve').mockImplementation(async () => {
    order.push('subscription'); return response(subscription())
  })
  jest.spyOn(stripe.customers, 'retrieve').mockResolvedValue(response({ id: customerId,
    metadata: { site_id: siteId }, deleted: false } as unknown as Stripe.Customer))
  jest.spyOn(stripe.prices, 'retrieve').mockResolvedValue(response(price))
  const invoices = jest.spyOn(stripe.invoices, 'retrieve').mockResolvedValue(response(invoice()))
  let billingId: string | null = 'sub_current'
  let status = 'active'
  let syncOutcome = 'synced'
  let coverageApplied = false
  let settlementResult = { outcome: 'settled', payment_id: randomUUID(), credits_granted: 20, coverage_recovered: false }
  const transport = jest.fn(async (url: RequestInfo | URL, request?: RequestInit) => {
    const target = new URL(String(url))
    if (target.hostname !== 'ordering.example.test') throw new Error('Unexpected Supabase network')
    let result: unknown
    if (target.pathname === '/rest/v1/billing' && request?.method !== 'PATCH') {
      order.push('billing'); result = { stripe_customer_id: customerId, stripe_subscription_id: billingId }
    } else if (target.pathname.endsWith('/rpc/sync_stripe_subscription_state')) {
      order.push('sync')
      const input = JSON.parse(String(request?.body))
      if (input.p_expected_subscription_id !== billingId) syncOutcome = 'obsolete_subscription'
      const invoiceSkipped = Boolean(input.p_invoice_id && coverageApplied && billingId === input.p_subscription_id)
      if (syncOutcome === 'synced' && !invoiceSkipped) status = input.p_status
      result = { outcome: syncOutcome, subscription_id: billingId, invoice_sync_skipped: invoiceSkipped }
    } else if (target.pathname.endsWith('/rpc/settle_stripe_subscription_invoice')) {
      order.push('settle'); result = settlementResult
    } else throw new Error('Unexpected Supabase operation')
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  const supabase = createClient('https://ordering.example.test', randomBytes(24).toString('hex'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: transport },
  })
  const rpc = jest.spyOn(supabase, 'rpc')
  const sync = () => syncStripeSubscription({ stripe, supabase, subscriptionId: 'sub_current', expectedCustomerId: customerId })
  const settle = () => settleStripeSubscriptionInvoice({ stripe, supabase, invoiceId: 'in_ordering' })
  const dispatch = (type: Stripe.Event.Type, object: Stripe.Subscription) => handleBillingStripeEvent({
    stripe, supabase, event: { id: `evt_${randomUUID()}`, type, data: { object } } as Stripe.Event,
  })
  return { stripe, supabase, subscriptions, invoices, transport, rpc, order, sync, settle, dispatch,
    status: () => status, bind: (id: string | null) => { billingId = id },
    obsolete: () => { syncOutcome = 'obsolete_subscription' },
    applied: () => { coverageApplied = true },
    result: (value: Partial<typeof settlementResult>) => { settlementResult = { ...settlementResult, ...value } },
  }
}
beforeEach(() => { process.env.STRIPE_STARTER_ANNUAL_PRICE_ID = price.id })
afterEach(() => {
  if (priceEnv === undefined) delete process.env.STRIPE_STARTER_ANNUAL_PRICE_ID
  else process.env.STRIPE_STARTER_ANNUAL_PRICE_ID = priceEnv
  jest.restoreAllMocks()
})

it('reads billing identity before the authoritative Stripe status and syncs before settlement', async () => {
  const h = harness()
  await h.settle()
  expect(h.order).toEqual(['billing', 'subscription', 'sync', 'settle'])
  expect(h.rpc.mock.calls[0]).toEqual(['sync_stripe_subscription_state', expect.objectContaining({
    p_expected_subscription_id: 'sub_current', p_subscription_id: 'sub_current', p_status: 'active',
    p_invoice_id: 'in_ordering',
  })])
})
it('fences replacement racing between billing read and Stripe retrieval', async () => {
  const h = harness()
  h.subscriptions.mockImplementation(async () => { h.bind('sub_replacement'); return response(subscription()) })
  expect(await h.settle()).toEqual({ outcome: 'obsolete_subscription', credits_granted: 0 })
  expect(h.rpc.mock.calls.map(([name]) => name)).toEqual(['sync_stripe_subscription_state'])
  expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_expected_subscription_id: 'sub_current' })
  expect(h.status()).toBe('active')
})
it.each(['customer.subscription.deleted', 'customer.subscription.updated'] as const)(
  'acknowledges obsolete %s without changing replacement status or replaying invoices', async (type) => {
    const h = harness()
    h.bind('sub_replacement'); h.obsolete()
    h.subscriptions.mockResolvedValue(response(subscription('sub_current', 'canceled', {
      latest_invoice: 'in_ordering', items: { data: [{ price: { id: 'price_retired' } }] },
    })))
    await h.dispatch(type, subscription('sub_current', 'active'))
    expect(h.status()).toBe('active')
    expect(h.invoices).not.toHaveBeenCalled()
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_subscription_id: 'sub_current', p_status: 'canceled',
      p_expected_subscription_id: 'sub_replacement' })
    expect(h.transport.mock.calls.every(([, request]) => request?.method !== 'PATCH')).toBe(true)
  },
)
it.each(['paid', 'open'])('obsolete %s invoice acknowledges without recording failure or granting credits', async (status) => {
  const h = harness(); h.obsolete(); h.bind('sub_replacement')
  h.invoices.mockResolvedValue(response(invoice('sub_current', { status })))
  expect(await h.settle()).toEqual({ outcome: 'obsolete_subscription', credits_granted: 0 })
  expect(h.rpc.mock.calls.map(([name]) => name)).toEqual(['sync_stripe_subscription_state'])
})
it('uses fresh Stripe status instead of reordered same-ID failure/cancellation event payloads', async () => {
  const h = harness()
  await h.dispatch('customer.subscription.deleted', subscription('sub_current', 'canceled'))
  expect(h.status()).toBe('active')
  h.subscriptions.mockResolvedValue(response(subscription('sub_current', 'paused')))
  await h.dispatch('customer.subscription.updated', subscription('sub_current', 'active'))
  expect(h.status()).toBe('paused')
  expect(h.invoices).not.toHaveBeenCalled()
})
it('active update recovers latest verified paid invoice without invoice webhook redelivery', async () => {
  const h = harness()
  h.subscriptions.mockResolvedValue(response(subscription('sub_current', 'active', { latest_invoice: 'in_ordering' })))
  h.result({ outcome: 'duplicate', coverage_recovered: true, credits_granted: 20 })
  await h.dispatch('customer.subscription.updated', subscription('sub_current', 'paused', { latest_invoice: 'in_stale' }))
  expect(h.rpc.mock.calls.map(([name]) => name)).toEqual([
    'sync_stripe_subscription_state', 'sync_stripe_subscription_state', 'settle_stripe_subscription_invoice',
  ])
  expect(h.invoices.mock.calls.every(([id]) => id === 'in_ordering')).toBe(true)
  expect(h.status()).toBe('active')
})
it('active update does not try to settle unpaid latest invoice', async () => {
  const h = harness()
  h.subscriptions.mockResolvedValue(response(subscription('sub_current', 'active', { latest_invoice: 'in_ordering' })))
  h.invoices.mockResolvedValue(response(invoice('sub_current', { status: 'open' })))
  await h.dispatch('customer.subscription.updated', subscription())
  expect(h.rpc.mock.calls.map(([name]) => name)).toEqual(['sync_stripe_subscription_state'])
})
it('accepts positive duplicate recovery exactly as SQL returns it, without additive app credit writes', async () => {
  const h = harness()
  h.result({ outcome: 'duplicate', coverage_recovered: true, credits_granted: 20 })
  expect(await h.settle()).toMatchObject({ outcome: 'duplicate', coverage_recovered: true, credits_granted: 20 })
  h.result({ outcome: 'duplicate', coverage_recovered: false, credits_granted: 0 })
  expect(await h.settle()).toMatchObject({ outcome: 'duplicate', credits_granted: 0 })
  expect(h.rpc.mock.calls.every(([name]) => ['sync_stripe_subscription_state', 'settle_stripe_subscription_invoice'].includes(name))).toBe(true)
})
it.each(['paused', 'canceled'])('already-applied duplicate %s snapshot cannot poison active billing status', async (status) => {
  const h = harness(); h.applied()
  h.subscriptions.mockResolvedValue(response(subscription('sub_current', status)))
  h.result({ outcome: 'duplicate', credits_granted: 0 })
  expect(await h.settle()).toMatchObject({ outcome: 'duplicate', credits_granted: 0 })
  expect(h.status()).toBe('active')
  expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_invoice_id: 'in_ordering', p_status: status })
})
it('invoice-aware guard covers another delivery applying coverage after billing read', async () => {
  const h = harness()
  h.subscriptions.mockImplementation(async () => { h.applied(); return response(subscription('sub_current', 'paused')) })
  h.result({ outcome: 'duplicate', credits_granted: 0 })
  await h.settle()
  expect(h.status()).toBe('active')
  expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_invoice_id: 'in_ordering' })
})