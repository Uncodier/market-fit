/** @jest-environment node */
import type Stripe from 'stripe'
import { configuredSubscriptionPrice } from '@/lib/subscription-pricing.server'
import { verifiedInvoiceEntitlements } from '@/app/api/stripe/webhook/subscription-invoice-entitlements'
import { resolveStripeSubscriptionDetails } from '@/app/api/stripe/webhook/subscription-billing'

const start = Date.UTC(2024, 1, 29, 10, 30) / 1000
const end = Date.UTC(2025, 1, 28, 10, 30) / 1000
const stripe = { prices: { retrieve: jest.fn() } }
function price(id: string): Stripe.Price {
  const config = configuredSubscriptionPrice(id)!
  return { id, active: true, currency: 'usd', type: 'recurring', billing_scheme: 'per_unit', unit_amount: config.amount,
    recurring: { interval: config.interval, interval_count: 1, usage_type: 'licensed' } } as Stripe.Price
}
function line(id = 'price_annual', quantity = 1, overrides = {}): Stripe.InvoiceLineItem {
  return { id: `il_${id}`, object: 'line_item', description: null, invoice: 'in_offline', livemode: false,
    metadata: {}, pretax_credit_amounts: [], taxes: [], subscription: 'sub_annual',
    quantity, currency: 'usd', amount: price(id).unit_amount! * quantity,
    discount_amounts: [], discounts: [], discountable: true,
    pricing: { type: 'price_details', price_details: { price: id, product: 'prod_offline' },
      unit_amount_decimal: String(price(id).unit_amount) }, period: { start, end },
    parent: { type: 'subscription_item_details', invoice_item_details: null,
      subscription_item_details: { subscription: 'sub_annual', subscription_item: `si_${id}`,
        invoice_item: null, proration: false, proration_details: { credited_items: null } } }, ...overrides }
}
function invoice(data = [line()], overrides = {}): Stripe.Invoice {
  return { status: 'paid', amount_paid: 0, billing_reason: 'subscription_cycle',
    period_start: start - 100, period_end: start, lines: { data, has_more: false }, ...overrides } as Stripe.Invoice
}
beforeEach(() => {
  process.env.STRIPE_STARTER_PRICE_ID = 'price_month'
  process.env.STRIPE_STARTER_ANNUAL_PRICE_ID = 'price_annual'
  process.env.STRIPE_ACCOUNT_ADDON_ANNUAL_PRICE_ID = 'price_addon_annual'
  stripe.prices.retrieve.mockImplementation(async (id) => price(id))
})
afterAll(() => {
  delete process.env.STRIPE_STARTER_PRICE_ID; delete process.env.STRIPE_STARTER_ANNUAL_PRICE_ID
  delete process.env.STRIPE_ACCOUNT_ADDON_ANNUAL_PRICE_ID
})

it('verifies discounted/zero-paid annual service + annual addons, with leap anniversary clamping', async () => {
  const result = await verifiedInvoiceEntitlements(invoice([line(), line('price_addon_annual', 3)]), 'sub_annual', stripe)
  expect(result).toEqual({ plan: 'engine', addonsCount: 3, billing_interval: 'year', coverage_verified: true,
    period_start: new Date(start * 1000).toISOString(), period_end: new Date(end * 1000).toISOString() })
})
it('uses annual price rather than stale monthly subscription metadata', () => {
  const subscription = { status: 'active', metadata: { plan: 'enterprise', billing_interval: 'month', addons_count: '100' },
    items: { has_more: false, data: [{ quantity: 1, price: price('price_annual'), current_period_end: end },
      { quantity: 2, price: price('price_addon_annual'), current_period_end: end }] } } as unknown as Stripe.Subscription
  expect(resolveStripeSubscriptionDetails(subscription)).toMatchObject({ plan: 'engine', billingInterval: 'year', addonsCount: 2 })
})
it('accepts subscription_update only with full verified new service, ignoring old negative prorations', async () => {
  const credit = line('price_month', 1, { amount: -1000,
    parent: { subscription_item_details: { subscription: 'sub_annual', proration: true } } })
  expect(await verifiedInvoiceEntitlements(invoice([credit, line()], { billing_reason: 'subscription_update' }), 'sub_annual', stripe))
    .toMatchObject({ coverage_verified: true, billing_interval: 'year', plan: 'engine' })
})
it('accepts a full-price full-period new service even when Stripe labels it proration', async () => {
  expect(await verifiedInvoiceEntitlements(invoice([line('price_annual', 1, {
    parent: { subscription_item_details: { subscription: 'sub_annual', proration: true } } })]), 'sub_annual', stripe))
    .toMatchObject({ billing_interval: 'year', coverage_verified: true })
})
// Stripe prorations docs: proration debits embed existing subscription discounts,
// have discountable=false and discount_amounts=[] (not gross amount + discounts).
it.each([20, 100])('verifies genuine full-period update line semantics with %i%% embedded discount', async (percent) => {
  const newService = (id: string, quantity: number) => line(id, quantity, {
    amount: price(id).unit_amount! * quantity * (100 - percent) / 100,
    discountable: false, discount_amounts: [], discounts: [],
    parent: { type: 'subscription_item_details', subscription_item_details: {
      subscription: 'sub_annual', subscription_item: `si_${id}`, invoice_item: 'ii_update',
      proration: true, proration_details: { credited_items: null },
    } },
  })
  const oldCredit = line('price_month', 1, { amount: percent === 100 ? 0 : -100,
    discountable: false, parent: { subscription_item_details: { subscription: 'sub_annual', proration: true,
      proration_details: { credited_items: { invoice: 'in_previous', invoice_line_items: ['il_previous'] } } } } })
  const value = invoice([oldCredit, newService('price_annual', 1), newService('price_addon_annual', 2)],
    { billing_reason: 'subscription_update' })
  expect(await verifiedInvoiceEntitlements(value, 'sub_annual', stripe))
    .toMatchObject({ billing_interval: 'year', plan: 'engine', addonsCount: 2, coverage_verified: true })
  for (const service of value.lines.data.slice(1)) service.period.end = end - 3600
  await expect(verifiedInvoiceEntitlements(value, 'sub_annual', stripe)).rejects.toThrow('full billing interval')
})
it.each([20, 100])('verifies regular full gross service with separately listed %i%% discount', async (percent) => {
  const gross = price('price_annual').unit_amount!
  const value = invoice([line('price_annual', 1, {
    amount: gross, discount_amounts: [{ amount: gross * percent / 100, discount: 'di_offline' }],
  })], { amount_paid: gross * (100 - percent) / 100 })
  expect(await verifiedInvoiceEntitlements(value, 'sub_annual', stripe)).toMatchObject({ coverage_verified: true })
})
it('verifies newer explicit pre-discount subtotal without inferring gross from the net amount', async () => {
  expect(await verifiedInvoiceEntitlements(invoice([line('price_annual', 1,
    { subtotal: 24840, amount: 0 })]), 'sub_annual', stripe)).toMatchObject({ coverage_verified: true })
  await expect(verifiedInvoiceEntitlements(invoice([line('price_annual', 1,
    { subtotal: 100, amount: 0 })]), 'sub_annual', stripe)).rejects.toThrow('subtotal')
})
it('rejects misconfigured live gross Price even on a fully discounted full-period proration', async () => {
  stripe.prices.retrieve.mockResolvedValue({ ...price('price_annual'), unit_amount: 100 })
  await expect(verifiedInvoiceEntitlements(invoice([line('price_annual', 1, {
    amount: 0, discountable: false, parent: { subscription_item_details: { subscription: 'sub_annual', proration: true } },
  })]), 'sub_annual', stripe)).rejects.toThrow('price is invalid')
})
it('rejects an overridden line gross unit amount despite a configured Price ID and full duration', async () => {
  await expect(verifiedInvoiceEntitlements(invoice([line('price_annual', 1, {
    amount: 0, discountable: false, pricing: { price_details: { price: 'price_annual' }, unit_amount_decimal: '100' },
    parent: { subscription_item_details: { subscription: 'sub_annual', proration: true } },
  })]), 'sub_annual', stripe)).rejects.toThrow('gross unit price')
})
it('recognizes a monthly renewal restoring the original 31st anchor after February', async () => {
  const period = { start: Date.UTC(2025, 1, 28, 10, 30) / 1000, end: Date.UTC(2025, 2, 31, 10, 30) / 1000 }
  expect(await verifiedInvoiceEntitlements(invoice([line('price_month', 1, { period })]), 'sub_annual', stripe))
    .toMatchObject({ billing_interval: 'month', coverage_verified: true })
})
it.each(['missing', 'pagination', 'positive_proration', 'partial_amount', 'partial_period', 'foreign', 'mixed_addon'])('fails closed for %s coverage', async (kind) => {
  let value = invoice()
  if (kind === 'missing') value = invoice([])
  if (kind === 'pagination') value = invoice([line()], { lines: { has_more: true, data: [line()] } })
  if (kind === 'positive_proration') value = invoice([line('price_annual', 1, { amount: 100,
    parent: { subscription_item_details: { subscription: 'sub_annual', proration: true } } })])
  if (kind === 'partial_amount') value = invoice([line('price_annual', 1, { amount: 100 })])
  if (kind === 'partial_period') value = invoice([line('price_annual', 1, { period: { start, end: end - 100 } })])
  if (kind === 'foreign') value = invoice([line('price_annual', 1, {
    parent: { subscription_item_details: { subscription: 'sub_foreign', proration: false } } })])
  if (kind === 'mixed_addon') value = invoice([line(), line('price_addon_annual', 1, { period: { start: start + 1, end } })])
  await expect(verifiedInvoiceEntitlements(value, 'sub_annual', stripe)).rejects.toThrow()
})