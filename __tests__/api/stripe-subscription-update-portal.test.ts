/** @jest-environment node */
import { randomBytes, randomUUID } from 'node:crypto'
import type Stripe from 'stripe'
import { existingSubscriptionFlow } from '@/app/api/stripe/checkout/subscription/subscription-update'

const siteId = randomUUID()
const sdk = {
  customers: { retrieve: jest.fn(), update: jest.fn() },
  invoices: { retrieve: jest.fn() },
  subscriptions: { list: jest.fn(), update: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
  billingPortal: {
    configurations: { retrieve: jest.fn(), list: jest.fn(), create: jest.fn(), update: jest.fn() },
    sessions: { create: jest.fn() },
  },
}
const beforeProviderWrite = jest.fn()
function price(interval: 'month' | 'year') {
  return { id: interval === 'month' ? 'price_month' : 'price_year', product: 'prod_platform', active: true,
    currency: 'usd', type: 'recurring', unit_amount: interval === 'month' ? 2300 : 24840,
    billing_scheme: 'per_unit', recurring: { interval, interval_count: 1, usage_type: 'licensed' } }
}
function subscription() {
  return { id: 'sub_existing', customer: 'cus_site', status: 'active', metadata: { plan: 'engine' },
    items: { has_more: false, data: [{ id: 'si_base', quantity: 1, price: price('month') }] } }
}
function configuration() {
  return { id: 'bpc_update', active: true, is_default: false, features: { subscription_update: {
    enabled: true, default_allowed_updates: ['price'], proration_behavior: 'always_invoice',
    schedule_at_period_end: { conditions: [] }, products: [{ product: 'prod_platform', prices: ['price_year', 'price_month'] }],
  } } }
}
function params() {
  return { stripe: sdk as unknown as Stripe, siteId, customerId: 'cus_site', subscriptionId: 'sub_existing',
    price: price('year') as Stripe.Price, interval: 'year' as const, addonsCount: 0,
    returnUrl: 'https://checkout.example.test/billing', successUrl: 'https://checkout.example.test/billing/success',
    idempotencyKey: randomBytes(24).toString('hex'), beforeProviderWrite }
}
function expectNoWrites() {
  expect(sdk.billingPortal.sessions.create).not.toHaveBeenCalled()
  expect(beforeProviderWrite).not.toHaveBeenCalled()
}
beforeEach(() => {
  jest.resetAllMocks()
  process.env.STRIPE_STARTER_PRICE_ID = 'price_month'
  process.env.STRIPE_STARTER_ANNUAL_PRICE_ID = 'price_year'
  process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID = 'bpc_generic'
  process.env.STRIPE_SUBSCRIPTION_UPDATE_PORTAL_CONFIGURATION_ID = 'bpc_update'
  sdk.customers.retrieve.mockResolvedValue({ id: 'cus_site', metadata: { site_id: siteId } })
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [subscription()] })
  sdk.invoices.retrieve.mockResolvedValue({ id: 'in_previous', customer: 'cus_site', subscription: 'sub_existing', status: 'paid' })
  sdk.billingPortal.configurations.retrieve.mockResolvedValue(configuration())
  sdk.billingPortal.sessions.create.mockResolvedValue({ id: 'bps_confirm', url: 'https://portal.example.test/confirm' })
})
afterEach(() => {
  for (const key of ['STRIPE_STARTER_PRICE_ID', 'STRIPE_STARTER_ANNUAL_PRICE_ID',
    'STRIPE_BILLING_PORTAL_CONFIGURATION_ID', 'STRIPE_SUBSCRIPTION_UPDATE_PORTAL_CONFIGURATION_ID']) delete process.env[key]
  expect(sdk.billingPortal.configurations.list).not.toHaveBeenCalled()
  expect(sdk.billingPortal.configurations.create).not.toHaveBeenCalled()
  expect(sdk.billingPortal.configurations.update).not.toHaveBeenCalled()
  expect(sdk.subscriptions.update).not.toHaveBeenCalled()
  expect(sdk.customers.update).not.toHaveBeenCalled()
  expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
})

describe('dedicated hosted subscription-update portal', () => {
  it('uses only the separately configured nondefault portal with the verified customer, subscription and target item', async () => {
    const input = params()
    expect(await existingSubscriptionFlow(input)).toEqual({ url: 'https://portal.example.test/confirm',
      sessionId: 'bps_confirm', flow: 'subscription_update_confirm' })
    expect(sdk.billingPortal.configurations.retrieve).toHaveBeenCalledWith('bpc_update')
    expect(beforeProviderWrite).toHaveBeenCalledTimes(1)
    expect(sdk.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_site', configuration: 'bpc_update', return_url: input.returnUrl,
      flow_data: { type: 'subscription_update_confirm', subscription_update_confirm: {
        subscription: 'sub_existing', items: [{ id: 'si_base', price: 'price_year', quantity: 1 }] },
      after_completion: { type: 'redirect', redirect: { return_url: input.successUrl } } },
    }, { idempotencyKey: `subscription-update-year-${input.idempotencyKey}` })
  })
  it.each([undefined, '', 'invalid', 'bpc_generic'])('requires explicit distinct configuration %s, never falls back to default', async (id) => {
    if (id === undefined) delete process.env.STRIPE_SUBSCRIPTION_UPDATE_PORTAL_CONFIGURATION_ID
    else process.env.STRIPE_SUBSCRIPTION_UPDATE_PORTAL_CONFIGURATION_ID = id
    await expect(existingSubscriptionFlow(params())).rejects.toMatchObject({ status: 409 })
    expect(sdk.billingPortal.configurations.retrieve).not.toHaveBeenCalled(); expectNoWrites()
  })
  it.each([{ active: false }, { is_default: true }, { is_default: undefined }, { id: 'bpc_other' },
    { features: {} }, { features: undefined }])('rejects unproven/default/inactive portal %#', async (override) => {
    sdk.billingPortal.configurations.retrieve.mockResolvedValue({ ...configuration(), ...override })
    await expect(existingSubscriptionFlow(params())).rejects.toMatchObject({ status: 409 }); expectNoWrites()
  })
  it.each([
    { enabled: false }, { default_allowed_updates: [] }, { default_allowed_updates: ['quantity'] },
    { default_allowed_updates: ['price', 'quantity'] }, { default_allowed_updates: ['price', 'promotion_code'] },
    { proration_behavior: 'create_prorations' }, { proration_behavior: 'none' },
    { schedule_at_period_end: { conditions: [{ type: 'shortening_interval' }] } },
    { schedule_at_period_end: { conditions: [{ type: 'decreasing_item_amount' }] } },
    { schedule_at_period_end: undefined }, { products: null },
    { products: [{ product: 'prod_other', prices: ['price_year'] }] },
    { products: [{ product: 'prod_platform', prices: ['price_month'] }] },
  ])('rejects unsupported proration/update/target settings %#', async (update) => {
    const config = configuration()
    sdk.billingPortal.configurations.retrieve.mockResolvedValue({ ...config, features: {
      subscription_update: { ...config.features.subscription_update, ...update } } })
    await expect(existingSubscriptionFlow(params())).rejects.toMatchObject({ status: 409 }); expectNoWrites()
  })
  it('handles expanded target products without confusing product and price IDs', async () => {
    const input = params(); input.price.product = { id: 'prod_platform' } as Stripe.Product
    await existingSubscriptionFlow(input)
    expect(sdk.billingPortal.sessions.create).toHaveBeenCalledTimes(1)
  })
  it('returns a safe 409 for an unavailable dedicated configuration', async () => {
    const sensitive = randomBytes(24).toString('hex')
    sdk.billingPortal.configurations.retrieve.mockRejectedValue(new Error(sensitive))
    let error: unknown
    try { await existingSubscriptionFlow(params()) } catch (failure) { error = failure }
    expect(error).toMatchObject({ status: 409 }); expect(String(error)).not.toContain(sensitive); expectNoWrites()
  })
  it.each([{ id: 'cus_other', metadata: { site_id: siteId } }, { id: 'cus_site', deleted: true },
    { id: 'cus_site', metadata: { site_id: randomUUID() } }, { id: 'cus_site' }])('rejects customer identity/binding mismatch %#', async (customer) => {
    sdk.customers.retrieve.mockResolvedValue(customer)
    await expect(existingSubscriptionFlow(params())).rejects.toMatchObject({ status: 409 })
    expect(sdk.subscriptions.list).not.toHaveBeenCalled(); expectNoWrites()
  })
  it('rejects a subscription returned for a different customer', async () => {
    sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...subscription(), customer: 'cus_other' }] })
    await expect(existingSubscriptionFlow(params())).rejects.toMatchObject({ status: 409 }); expectNoWrites()
  })
  it('does not update another current subscription when the stored one is canceled', async () => {
    sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [
      { ...subscription(), status: 'canceled' }, { ...subscription(), id: 'sub_other' }] })
    await expect(existingSubscriptionFlow(params())).rejects.toMatchObject({ status: 409 }); expectNoWrites()
  })
  it.each([0, 2, undefined])('rejects unsupported base quantity %s instead of overwriting it', async (quantity) => {
    const sub = subscription()
    sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...sub,
      items: { has_more: false, data: [{ ...sub.items.data[0], quantity }] } }] })
    await expect(existingSubscriptionFlow(params())).rejects.toMatchObject({ status: 409 }); expectNoWrites()
  })
  it('rejects add-on changes even with an otherwise valid configuration', async () => {
    await expect(existingSubscriptionFlow({ ...params(), addonsCount: 1 })).rejects.toMatchObject({ status: 409 })
    expect(sdk.billingPortal.configurations.retrieve).not.toHaveBeenCalled(); expectNoWrites()
  })
  it('keeps new subscription checkout independent of portal availability', async () => {
    delete process.env.STRIPE_SUBSCRIPTION_UPDATE_PORTAL_CONFIGURATION_ID
    sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [] })
    expect(await existingSubscriptionFlow({ ...params(), subscriptionId: null })).toBeNull()
    expect(sdk.billingPortal.configurations.retrieve).not.toHaveBeenCalled(); expectNoWrites()
  })
})