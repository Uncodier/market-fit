/** @jest-environment node */
import { randomUUID } from 'node:crypto'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { configuredSubscriptionPrice, resolveSubscriptionCheckoutPrices } from '@/lib/subscription-pricing.server'
import { configuredHistoricalSubscriptionPrice } from '@/lib/subscription-history-pricing.server'
import { resolveStripeSubscriptionDetails } from '@/app/api/stripe/webhook/subscription-billing'
import { verifiedInvoiceEntitlements } from '@/app/api/stripe/webhook/subscription-invoice-entitlements'
import { settleStripeSubscriptionInvoice } from '@/app/api/stripe/webhook/subscription-invoice-settlement'

const keys = ['STRIPE_STARTER_PRICE_ID', 'STRIPE_STARTUP_PRICE_ID', 'STRIPE_ENTERPRISE_PRICE_ID',
  'STRIPE_ACCOUNT_ADDON_PRICE_ID', 'STRIPE_STARTER_ANNUAL_PRICE_ID', 'STRIPE_STARTUP_ANNUAL_PRICE_ID',
  'STRIPE_ENTERPRISE_ANNUAL_PRICE_ID', 'STRIPE_ACCOUNT_ADDON_ANNUAL_PRICE_ID',
  'STRIPE_ENTERPRISE_LEGACY_MONTHLY_PRICE_IDS', 'STRIPE_ENTERPRISE_LEGACY_MONTHLY_AMOUNT']
const original = Object.fromEntries(keys.map(key => [key, process.env[key]]))
const newId = `price_${randomUUID().replaceAll('-', '')}`
const oldIds = [0, 1].map(() => `price_${randomUUID().replaceAll('-', '')}`)
const siteId = randomUUID()
const start = Date.UTC(2026, 8, 1) / 1000
const end = Date.UTC(2026, 9, 1) / 1000
const retrieve = jest.fn()
const stripe = { prices: { retrieve } }

function price(id: string, overrides = {}): Stripe.Price {
  return { id, active: false, currency: 'usd', type: 'recurring', unit_amount: 49900,
    billing_scheme: 'per_unit', transform_quantity: null,
    recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' }, ...overrides } as Stripe.Price
}
function subscription(id = oldIds[0]): Stripe.Subscription {
  return { id: 'sub_history', customer: 'cus_history', status: 'active', metadata: { plan: 'engine' },
    items: { has_more: false, data: [{ quantity: 1, price: price(id), current_period_end: end }] } } as unknown as Stripe.Subscription
}
function invoice(id = oldIds[0], amount = 49900): Stripe.Invoice {
  return { id: 'in_history', customer: 'cus_history', status: 'paid', currency: 'usd',
    parent: { subscription_details: { subscription: 'sub_history' } },
    billing_reason: 'subscription_cycle', amount_paid: amount, status_transitions: { paid_at: start },
    lines: { has_more: false, data: [{ id: 'il_history', quantity: 1, amount, currency: 'usd',
      period: { start, end }, pricing: { price_details: { price: id }, unit_amount_decimal: '49900' },
      parent: { subscription_item_details: { subscription: 'sub_history', proration: false } } }] } } as unknown as Stripe.Invoice
}

beforeEach(() => {
  keys.forEach(key => { delete process.env[key] })
  process.env.STRIPE_ENTERPRISE_PRICE_ID = newId
  process.env.STRIPE_ENTERPRISE_LEGACY_MONTHLY_PRICE_IDS = oldIds.join(', ')
  process.env.STRIPE_ENTERPRISE_LEGACY_MONTHLY_AMOUNT = '49900'
  retrieve.mockReset().mockImplementation(async id => price(id))
})
afterAll(() => keys.forEach(key => {
  if (original[key] === undefined) delete process.env[key]
  else process.env[key] = original[key]
}))

it.each(oldIds)('verifies each separately allowlisted retired $499 monthly Price %s', async id => {
  expect(configuredSubscriptionPrice(id)).toBeUndefined()
  expect(configuredHistoricalSubscriptionPrice(id)).toMatchObject({ plan: 'enterprise', interval: 'month', amount: 49900 })
  expect(resolveStripeSubscriptionDetails(subscription(id))).toMatchObject({ plan: 'enterprise', billingInterval: 'month' })
  expect(await verifiedInvoiceEntitlements(invoice(id), 'sub_history', stripe))
    .toMatchObject({ plan: 'enterprise', billing_interval: 'month', coverage_verified: true })
  expect(retrieve).toHaveBeenCalledWith(id)
})

it('keeps a legacy currently configured ID read-only; checkout still requires active $500', async () => {
  process.env.STRIPE_ENTERPRISE_PRICE_ID = oldIds[0]
  expect(configuredSubscriptionPrice(oldIds[0])?.amount).toBe(50000)
  expect(configuredHistoricalSubscriptionPrice(oldIds[0])?.amount).toBe(49900)
  expect(await verifiedInvoiceEntitlements(invoice(), 'sub_history', stripe)).toMatchObject({ plan: 'enterprise' })
  retrieve.mockResolvedValue(price(oldIds[0], { active: true }))
  await expect(resolveSubscriptionCheckoutPrices(stripe as unknown as Pick<Stripe, 'prices'>, 'enterprise', 'month', 0))
    .rejects.toThrow('price is invalid')
})

it('selects only current active $500 Enterprise for new checkout, never a historical ID fallback', async () => {
  retrieve.mockImplementation(async id => price(id, { active: true, unit_amount: 50000 }))
  expect((await resolveSubscriptionCheckoutPrices(stripe as unknown as Pick<Stripe, 'prices'>, 'enterprise', 'month', 0)).base)
    .toMatchObject({ priceId: newId, amount: 50000 })
  expect(retrieve).toHaveBeenCalledTimes(1)
  expect(retrieve).toHaveBeenCalledWith(newId)
  delete process.env.STRIPE_ENTERPRISE_PRICE_ID
  await expect(resolveSubscriptionCheckoutPrices(stripe as unknown as Pick<Stripe, 'prices'>, 'enterprise', 'month', 0))
    .rejects.toThrow('not configured')
})

it('fails closed for unknown $499 IDs without retrieving or deriving identity from metadata', async () => {
  const unknown = `price_${randomUUID().replaceAll('-', '')}`
  expect(() => resolveStripeSubscriptionDetails(subscription(unknown))).toThrow('unknown')
  await expect(verifiedInvoiceEntitlements(invoice(unknown), 'sub_history', stripe)).rejects.toThrow('not configured')
  expect(retrieve).not.toHaveBeenCalled()
})

it('does not infer historical trust from the currently configured ID when no allowlist exists', async () => {
  delete process.env.STRIPE_ENTERPRISE_LEGACY_MONTHLY_PRICE_IDS
  delete process.env.STRIPE_ENTERPRISE_LEGACY_MONTHLY_AMOUNT
  process.env.STRIPE_ENTERPRISE_PRICE_ID = oldIds[0]
  await expect(verifiedInvoiceEntitlements(invoice(), 'sub_history', stripe)).rejects.toThrow('price is invalid')
})

it.each([undefined, '', '499', '50000', '49900.0', '-49900'])('requires the explicit exact historical amount %s', async amount => {
  if (amount === undefined) delete process.env.STRIPE_ENTERPRISE_LEGACY_MONTHLY_AMOUNT
  else process.env.STRIPE_ENTERPRISE_LEGACY_MONTHLY_AMOUNT = amount
  await expect(verifiedInvoiceEntitlements(invoice(), 'sub_history', stripe)).rejects.toThrow('not configured safely')
  expect(retrieve).not.toHaveBeenCalled()
})

it.each(['', ',price_test', 'price_test,', 'price_test,price_test', 'price_test,not_a_price', '*', 'price_test price_other'])
('rejects malformed or absent allowlist %s', ids => {
  process.env.STRIPE_ENTERPRISE_LEGACY_MONTHLY_PRICE_IDS = ids
  expect(() => configuredHistoricalSubscriptionPrice(oldIds[0])).toThrow()
})

it.each(['STRIPE_STARTER_PRICE_ID', 'STRIPE_ACCOUNT_ADDON_PRICE_ID', 'STRIPE_ENTERPRISE_ANNUAL_PRICE_ID'])
('rejects ambiguous historical collision with %s', key => {
  process.env[key] = oldIds[0]
  expect(() => configuredHistoricalSubscriptionPrice(oldIds[0])).toThrow('Ambiguous')
})

it.each([{ unit_amount: 50000 }, { currency: 'eur' }, { id: newId }, { type: 'one_time' },
  { recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' } },
  { recurring: { interval: 'month', interval_count: 2, usage_type: 'licensed' } },
  { recurring: { interval: 'month', interval_count: 1, usage_type: 'metered' } },
  { billing_scheme: 'tiered' }, { transform_quantity: { divide_by: 2, round: 'up' } }])
('verifies provider Price properties before accepting old invoice %#', async overrides => {
  retrieve.mockResolvedValue(price(oldIds[0], overrides))
  await expect(verifiedInvoiceEntitlements(invoice(), 'sub_history', stripe)).rejects.toThrow('price is invalid')
})

it('requires verified $499 gross invoice lines, not merely an allowlisted ID', async () => {
  await expect(verifiedInvoiceEntitlements(invoice(oldIds[0], 50000), 'sub_history', stripe)).rejects.toThrow('amount')
  const value = invoice()
  value.lines.data[0].pricing!.unit_amount_decimal = '50000'
  await expect(verifiedInvoiceEntitlements(value, 'sub_history', stripe)).rejects.toThrow('gross unit price')
})

it('settles an old paid invoice after the subscription has moved to new $500 without inferring invoice price from current service', async () => {
  const current = subscription(newId)
  current.items.data[0].price = price(newId, { active: true, unit_amount: 50000 })
  const from = jest.fn(() => ({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    single: jest.fn(async () => ({ data: { stripe_customer_id: 'cus_history', stripe_subscription_id: 'sub_history' }, error: null })) }))
  const rpc = jest.fn(async name => ({ data: name === 'sync_stripe_subscription_state'
    ? { outcome: 'synced', subscription_id: 'sub_history' }
    : { outcome: 'settled', payment_id: randomUUID(), credits_granted: 500 }, error: null }))
  const sdk = { ...stripe, invoices: { retrieve: jest.fn(async () => invoice()) },
    customers: { retrieve: jest.fn(async () => ({ id: 'cus_history', metadata: { site_id: siteId } })) },
    subscriptions: { retrieve: jest.fn(async () => current) } }
  await expect(settleStripeSubscriptionInvoice({ invoiceId: 'in_history', requirePaid: true,
    stripe: sdk as unknown as Stripe, supabase: { from, rpc } as unknown as SupabaseClient })).resolves.toMatchObject({ outcome: 'settled' })
  expect(rpc).toHaveBeenCalledWith('settle_stripe_subscription_invoice', { p_invoice: expect.objectContaining({
    amount: 499, plan: 'enterprise', billing_interval: 'month', coverage_verified: true,
    current_service: { plan: 'enterprise', addons_count: 0, billing_interval: 'month' },
  }) })
  rpc.mockClear()
  retrieve.mockResolvedValue(price(oldIds[0], { unit_amount: 50000 }))
  await expect(settleStripeSubscriptionInvoice({ invoiceId: 'in_history', requirePaid: true,
    stripe: sdk as unknown as Stripe, supabase: { from, rpc } as unknown as SupabaseClient })).rejects.toThrow('price is invalid')
  expect(rpc).not.toHaveBeenCalled()
})