/** @jest-environment node */
import type Stripe from 'stripe'
import { existingSubscriptionFlow } from '@/app/api/stripe/checkout/subscription/subscription-update'
import { resolveStripeSubscriptionDetails } from '@/app/api/stripe/webhook/subscription-billing'
import { verifiedInvoiceEntitlements } from '@/app/api/stripe/webhook/subscription-invoice-entitlements'

const start = Math.floor(Date.now() / 1000) - 86400
const finish = new Date(start * 1000)
finish.setUTCMonth(finish.getUTCMonth() + 1)
const end = finish.getTime() / 1000
const price = { id: 'price_free_extra', active: true, product: 'prod_extra', currency: 'usd',
  unit_amount: 1000, type: 'recurring', billing_scheme: 'per_unit',
  recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } } as Stripe.Price
const item = (quantity = 2) => ({ id: 'si_extra', price, quantity,
  current_period_start: start, current_period_end: end })
const sub = (quantity = 2) => ({ id: 'sub_free', customer: 'cus_free', status: 'active',
  collection_method: 'charge_automatically', latest_invoice: 'in_previous',
  metadata: { site_id: 'site_free', plan: 'commission' },
  items: { has_more: false, data: [item(quantity)] } })
const line = (quantity = 2) => ({ pricing: { price_details: { price: price.id } }, quantity,
  amount: 1000 * quantity, currency: 'usd', period: { start, end },
  parent: { subscription_item_details: { subscription: 'sub_free', proration: false } } })
const invoice = () => ({ id: 'in_previous', customer: 'cus_free', subscription: 'sub_free', status: 'paid',
  billing_reason: 'subscription_update', lines: { has_more: false, data: [line()] } })
const schedule = (target?: number) => ({ id: 'sub_sched_free', customer: 'cus_free', subscription: 'sub_free',
  status: 'active', end_behavior: target ? 'release' : 'renew', current_phase: { start_date: start, end_date: end },
  phases: [{ start_date: start, end_date: end, items: [{ price: price.id, quantity: 2 }] },
    ...(target ? [{ start_date: end, items: [{ price: price.id, quantity: target }] }] : [])],
  ...(target ? { metadata: { addon_target: String(target), addon_period_end: String(end) } } : {}) })
const sdk = { customers: { retrieve: jest.fn() }, subscriptions: { list: jest.fn(), update: jest.fn() },
  prices: { retrieve: jest.fn() }, invoices: { retrieve: jest.fn() },
  subscriptionSchedules: { create: jest.fn(), retrieve: jest.fn(), update: jest.fn() } }
const beforeProviderWrite = jest.fn()
const input = (count: number) => ({ stripe: sdk as unknown as Stripe, siteId: 'site_free', customerId: 'cus_free',
  subscriptionId: 'sub_free', plan: 'commission' as const, addonPrice: price, interval: 'month' as const,
  addonsCount: count, requiredAddons: 0, idempotencyKey: 'free-key', beforeProviderWrite,
  returnUrl: 'https://example.test/billing', successUrl: 'https://example.test/billing' })
beforeEach(() => {
  jest.clearAllMocks()
  process.env.STRIPE_ACCOUNT_ADDON_PRICE_ID = price.id
  sdk.customers.retrieve.mockResolvedValue({ id: 'cus_free', metadata: { site_id: 'site_free' } })
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [sub()] })
  sdk.prices.retrieve.mockResolvedValue(price)
  sdk.invoices.retrieve.mockResolvedValue(invoice())
  sdk.subscriptions.update.mockResolvedValue({ ...sub(3), latest_invoice: { status: 'paid' } })
  sdk.subscriptionSchedules.create.mockResolvedValue(schedule())
  sdk.subscriptionSchedules.retrieve.mockResolvedValue(schedule())
  sdk.subscriptionSchedules.update.mockResolvedValue(schedule(1))
})
afterAll(() => { delete process.env.STRIPE_ACCOUNT_ADDON_PRICE_ID })

it('infers Free from verified add-on items, not metadata', () => {
  expect(resolveStripeSubscriptionDetails({ ...sub(), metadata: { plan: 'enterprise' } } as unknown as Stripe.Subscription))
    .toMatchObject({ plan: 'commission', addonsCount: 2, billingInterval: 'month' })
})
it('verifies full-period Free invoice service without any base item', async () => {
  expect(await verifiedInvoiceEntitlements(invoice() as unknown as Stripe.Invoice, 'sub_free', sdk))
    .toMatchObject({ plan: 'commission', addonsCount: 2, coverage_verified: true, billing_interval: 'month' })
})
it.each([0, -1])('rejects invalid Free quantity %s', quantity => {
  expect(() => resolveStripeSubscriptionDetails(sub(quantity) as unknown as Stripe.Subscription)).toThrow()
})
it('rejects ambiguous duplicate add-on items and partial invoice periods', async () => {
  expect(() => resolveStripeSubscriptionDetails({ ...sub(), items: { data: [item(), item()] } } as unknown as Stripe.Subscription)).toThrow()
  const partial = { ...invoice(), lines: { data: [{ ...line(), period: { start, end: end - 1 } }] } }
  await expect(verifiedInvoiceEntitlements(partial as unknown as Stripe.Invoice, 'sub_free', sdk)).rejects.toThrow('full billing interval')
})
it('increases only the extra quantity and starts a paid full period', async () => {
  expect(await existingSubscriptionFlow(input(3))).toEqual({ flow: 'prorated_addon', status: 'paid' })
  expect(sdk.subscriptions.update).toHaveBeenCalledWith('sub_free', expect.objectContaining({
    items: [{ id: 'si_extra', price: price.id, quantity: 3 }], billing_cycle_anchor: 'now',
    payment_behavior: 'pending_if_incomplete', proration_behavior: 'always_invoice',
  }), expect.any(Object))
})
it('recovers a verified pending Free increase without charging again', async () => {
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...sub(), pending_update: {
    expires_at: end, subscription_items: [{ price, quantity: 3 }],
  } }] })
  sdk.invoices.retrieve.mockResolvedValue({ ...invoice(), status: 'open', hosted_invoice_url: 'https://invoice.stripe.com/i/test' })
  expect(await existingSubscriptionFlow(input(3))).toMatchObject({ flow: 'prorated_addon', status: 'pending_payment' })
  expect(sdk.subscriptions.update).not.toHaveBeenCalled()
})
it('recovers paid equal quantity from invoice lines without a base', async () => {
  expect(await existingSubscriptionFlow(input(2))).toMatchObject({ flow: 'prorated_addon', status: 'paid' })
  expect(beforeProviderWrite).not.toHaveBeenCalled()
})
it('recovers paid full-period discounted new-service proration but not partial or old-credit service', async () => {
  sdk.invoices.retrieve.mockResolvedValue({ ...invoice(), lines: { has_more: false, data: [{
    ...line(), amount: 0, discountable: false,
    parent: { subscription_item_details: { subscription: 'sub_free', proration: true } },
  }] } })
  expect(await existingSubscriptionFlow(input(2))).toMatchObject({ status: 'paid' })
  sdk.invoices.retrieve.mockResolvedValue({ ...invoice(), lines: { has_more: false, data: [{ ...line(), amount: 1 }] } })
  await expect(existingSubscriptionFlow(input(2))).rejects.toThrow('full service amount')
  expect(beforeProviderWrite).not.toHaveBeenCalled()
})
it('reduces positive extra quantity at renewal retaining one paid item', async () => {
  expect(await existingSubscriptionFlow(input(1))).toMatchObject({ flow: 'scheduled_addon_reduction' })
  expect(sdk.subscriptionSchedules.update).toHaveBeenCalledWith('sub_sched_free', expect.objectContaining({
    phases: expect.arrayContaining([expect.objectContaining({ start_date: end, items: [{ price: price.id, quantity: 1 }] })]),
  }), expect.any(Object))
})
it('schedules zero as cancellation, never an empty subscription phase', async () => {
  sdk.subscriptions.update.mockResolvedValue({ ...sub(), cancel_at_period_end: true, cancel_at: end })
  expect(await existingSubscriptionFlow(input(0))).toEqual({ flow: 'scheduled_addon_reduction', effectiveAt: new Date(end * 1000).toISOString() })
  expect(sdk.subscriptions.update).toHaveBeenCalledWith('sub_free', { cancel_at_period_end: true }, expect.any(Object))
  expect(sdk.subscriptionSchedules.create).not.toHaveBeenCalled()
})
it('preserves an explicit subscription card across positive reduction phases', async () => {
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...sub(), default_payment_method: 'pm_savedCard' }] })
  sdk.subscriptionSchedules.create.mockResolvedValue({ ...schedule(), default_settings: { default_payment_method: 'pm_savedCard' } })
  sdk.subscriptionSchedules.update.mockResolvedValue({ ...schedule(1), phases: schedule(1).phases.map(phase =>
    ({ ...phase, default_payment_method: 'pm_savedCard' })) })
  expect(await existingSubscriptionFlow(input(1))).toMatchObject({ flow: 'scheduled_addon_reduction' })
  expect(sdk.subscriptionSchedules.update.mock.calls[0][1].phases.every((phase: { default_payment_method?: string }) =>
    phase.default_payment_method === 'pm_savedCard')).toBe(true)
})
it('does not replace a schedule that would switch the saved payment method', async () => {
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...sub(), default_payment_method: 'pm_savedCard', schedule: 'sub_sched_free' }] })
  sdk.subscriptionSchedules.retrieve.mockResolvedValue({ ...schedule(1), default_settings: { default_payment_method: 'pm_otherCard' } })
  await expect(existingSubscriptionFlow(input(1))).rejects.toMatchObject({ status: 409 })
  expect(sdk.subscriptionSchedules.update).not.toHaveBeenCalled()
})
it('recovers a cancellation retry without rewriting or charging', async () => {
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...sub(), cancel_at_period_end: true, cancel_at: end }] })
  expect(await existingSubscriptionFlow(input(0))).toMatchObject({ flow: 'scheduled_addon_reduction' })
  expect(beforeProviderWrite).not.toHaveBeenCalled()
  await expect(existingSubscriptionFlow(input(3))).rejects.toMatchObject({ status: 409 })
})
it('fails closed for connected-account reductions, schedules, or pending zero cancellation', async () => {
  await expect(existingSubscriptionFlow({ ...input(0), requiredAddons: 1 })).rejects.toMatchObject({ status: 409 })
  for (const extra of [{ schedule: 'sub_sched_free' }, { pending_update: { expires_at: end } }]) {
    sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...sub(), ...extra }] })
    await expect(existingSubscriptionFlow(input(0))).rejects.toMatchObject({ status: 409 })
  }
  expect(beforeProviderWrite).not.toHaveBeenCalled()
})
it('rejects interval/plan changes and unverified customers without writes', async () => {
  await expect(existingSubscriptionFlow({ ...input(1), interval: 'year' })).rejects.toMatchObject({ status: 409 })
  await expect(existingSubscriptionFlow({ ...input(1), plan: 'foundry' })).rejects.toMatchObject({ status: 409 })
  sdk.customers.retrieve.mockResolvedValue({ id: 'cus_free', metadata: { site_id: 'site_foreign' } })
  await expect(existingSubscriptionFlow(input(1))).rejects.toMatchObject({ status: 409 })
  expect(beforeProviderWrite).not.toHaveBeenCalled()
})