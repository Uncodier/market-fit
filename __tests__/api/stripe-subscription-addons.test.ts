/** @jest-environment node */
import type Stripe from 'stripe'
import { existingSubscriptionFlow } from '@/app/api/stripe/checkout/subscription/subscription-update'

const start = Math.floor(Date.now() / 1000) - 86400
const end = start + 30 * 86400
const price = (id: string, amount: number) => ({ id, active: true, product: 'prod_platform', currency: 'usd',
  unit_amount: amount, type: 'recurring', billing_scheme: 'per_unit',
  recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } }) as Stripe.Price
const base = price('price_addon_test_base', 9900)
const addon = price('price_addon_test_extra', 1000)
const item = (id: string, cost: Stripe.Price, quantity: number) => ({ id, price: cost, quantity,
  current_period_start: start, current_period_end: end })
const subscription = (count = 1) => ({ id: 'sub_addons', customer: 'cus_addons', status: 'active',
  collection_method: 'charge_automatically', latest_invoice: 'in_previous',
  items: { has_more: false, data: [item('si_base', base, 1), ...(count ? [item('si_addon', addon, count)] : [])] } })
const schedule = (count = 1, next?: number) => ({ id: 'sub_sched_addon', customer: 'cus_addons',
  subscription: 'sub_addons', status: 'active', end_behavior: next === undefined ? 'renew' : 'release',
  current_phase: { start_date: start, end_date: end }, phases: [
    { start_date: start, end_date: end, items: [{ price: base.id, quantity: 1 }, { price: addon.id, quantity: count }] },
    ...(next === undefined ? [] : [{ start_date: end, items: [{ price: base.id, quantity: 1 },
      ...(next ? [{ price: addon.id, quantity: next }] : [])] }]),
  ], ...(next === undefined ? {} : { metadata: { addon_target: String(next), addon_period_end: String(end) } }) })
const sdk = {
  customers: { retrieve: jest.fn() }, subscriptions: { list: jest.fn(), update: jest.fn() },
  invoices: { retrieve: jest.fn() }, prices: { retrieve: jest.fn() },
  subscriptionSchedules: { retrieve: jest.fn(), create: jest.fn(), update: jest.fn() },
}
const beforeProviderWrite = jest.fn()
function input(count: number) {
  return { stripe: sdk as unknown as Stripe, siteId: 'site_addons', customerId: 'cus_addons',
    subscriptionId: 'sub_addons', price: base, addonPrice: addon, interval: 'month' as const,
    addonsCount: count, requiredAddons: 0, idempotencyKey: 'test-key',
    returnUrl: 'https://example.test/billing', successUrl: 'https://example.test/billing/success', beforeProviderWrite }
}
beforeEach(() => {
  jest.clearAllMocks()
  process.env.STRIPE_STARTUP_PRICE_ID = base.id
  process.env.STRIPE_ACCOUNT_ADDON_PRICE_ID = addon.id
  sdk.customers.retrieve.mockResolvedValue({ id: 'cus_addons', metadata: { site_id: 'site_addons' } })
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [subscription()] })
  sdk.invoices.retrieve.mockResolvedValue({ id: 'in_previous', customer: 'cus_addons', subscription: 'sub_addons', status: 'paid' })
  sdk.prices.retrieve.mockResolvedValue(addon)
  sdk.subscriptionSchedules.create.mockResolvedValue(schedule())
  sdk.subscriptionSchedules.retrieve.mockResolvedValue(schedule())
  sdk.subscriptionSchedules.update.mockResolvedValue({ ...schedule(1, 0), phases: schedule(1, 0).phases })
  sdk.subscriptions.update.mockResolvedValue({ id: 'sub_addons', customer: 'cus_addons',
    latest_invoice: { status: 'paid' }, pending_update: null })
})
afterAll(() => { delete process.env.STRIPE_STARTUP_PRICE_ID; delete process.env.STRIPE_ACCOUNT_ADDON_PRICE_ID })

it('charges a full new period and credits unused service when increasing add-ons', async () => {
  expect(await existingSubscriptionFlow(input(2))).toEqual({ flow: 'prorated_addon', status: 'paid' })
  expect(sdk.subscriptions.update).toHaveBeenCalledWith('sub_addons', {
    items: [{ id: 'si_base', price: base.id, quantity: 1 }, { id: 'si_addon', price: addon.id, quantity: 2 }],
    billing_cycle_anchor: 'now', proration_behavior: 'always_invoice',
    payment_behavior: 'pending_if_incomplete', expand: ['latest_invoice'],
  }, expect.any(Object))
})
it('preserves existing subscription and item discounts on an add-on increase', async () => {
  const current = subscription()
  sdk.subscriptions.list.mockResolvedValue({ data: [{ ...current, discounts: ['di_existing'],
    items: { ...current.items, data: current.items.data.map(item => ({ ...item, discounts: ['di_item'] })) } }], has_more: false })
  await expect(existingSubscriptionFlow(input(2))).resolves.toMatchObject({ flow: 'prorated_addon', status: 'paid' })
  const update = sdk.subscriptions.update.mock.calls[0][1]
  expect(update).not.toHaveProperty('discounts')
  expect(update.items.every((item: object) => !('discounts' in item))).toBe(true)
})
it('does not schedule a reduction with unverified phase discounts', async () => {
  sdk.subscriptions.list.mockResolvedValue({ data: [{ ...subscription(), discounts: ['di_existing'] }], has_more: false })
  await expect(existingSubscriptionFlow(input(0))).rejects.toMatchObject({ status: 409 })
  expect(sdk.subscriptionSchedules.update).not.toHaveBeenCalled()
  expect(sdk.subscriptions.update).not.toHaveBeenCalled()
})
it('retains subscription and item Discount IDs across scheduled reduction phases', async () => {
  const current = subscription()
  sdk.subscriptions.list.mockResolvedValue({ data: [{ ...current, discounts: ['di_existing'],
    items: { ...current.items, data: current.items.data.map(item => ({ ...item, discounts: ['di_item'] })) } }], has_more: false })
  const kept = { ...schedule(), phases: schedule().phases.map(phase => ({ ...phase,
    discounts: [{ discount: 'di_existing' }], items: phase.items.map(item => ({ ...item, discounts: [{ discount: 'di_item' }] })) })) }
  sdk.subscriptionSchedules.create.mockResolvedValue(kept)
  sdk.subscriptionSchedules.update.mockImplementation(async (_id, update) => ({ ...kept, ...update, status: 'active' }))
  await expect(existingSubscriptionFlow(input(0))).resolves.toMatchObject({ flow: 'scheduled_addon_reduction' })
  const phases = sdk.subscriptionSchedules.update.mock.calls[0][1].phases
  for (const phase of phases) {
    expect(phase.discounts).toEqual([{ discount: 'di_existing' }])
    for (const item of phase.items) expect(item.discounts).toEqual([{ discount: 'di_item' }])
  }
})
it('does not activate an increase while invoice payment is pending', async () => {
  sdk.subscriptions.update.mockResolvedValue({ id: 'sub_addons', customer: 'cus_addons', latest_invoice: 'in_pending',
    pending_update: { expires_at: end, subscription_items: [{ price: base, quantity: 1 }, { price: addon, quantity: 2 }] } })
  sdk.invoices.retrieve.mockImplementation(async id => id === 'in_previous'
    ? { id, customer: 'cus_addons', subscription: 'sub_addons', status: 'paid' }
    : { id, customer: 'cus_addons', subscription: 'sub_addons', status: 'open',
      billing_reason: 'subscription_update', hosted_invoice_url: 'https://invoice.stripe.com/i/test' })
  expect(await existingSubscriptionFlow(input(2))).toEqual({ flow: 'prorated_addon', status: 'pending_payment',
    url: 'https://invoice.stripe.com/i/test' })
})
it('retries a pending add-on payment through a verified invoice without another update', async () => {
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...subscription(),
    latest_invoice: 'in_pending', pending_update: { expires_at: end,
      subscription_items: [{ price: base, quantity: 1 }, { price: addon, quantity: 2 }] } }] })
  sdk.invoices.retrieve.mockResolvedValue({ id: 'in_pending', customer: 'cus_addons', subscription: 'sub_addons',
    status: 'open', billing_reason: 'subscription_update',
    hosted_invoice_url: 'https://invoice.stripe.com/i/test' })
  expect(await existingSubscriptionFlow(input(2))).toMatchObject({ flow: 'prorated_addon', status: 'pending_payment' })
  expect(sdk.subscriptions.update).not.toHaveBeenCalled()
})
it('rejects an untrusted payment URL and an unpaid prior invoice', async () => {
  sdk.invoices.retrieve.mockResolvedValue({ id: 'in_previous', customer: 'cus_addons',
    subscription: 'sub_addons', status: 'open' })
  await expect(existingSubscriptionFlow(input(2))).rejects.toMatchObject({ status: 409 })
  expect(sdk.subscriptions.update).not.toHaveBeenCalled()
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...subscription(),
    latest_invoice: 'in_pending', pending_update: { expires_at: end,
      subscription_items: [{ price: base, quantity: 1 }, { price: addon, quantity: 2 }] } }] })
  sdk.invoices.retrieve.mockResolvedValue({ id: 'in_pending', customer: 'cus_addons', subscription: 'sub_addons',
    status: 'open', billing_reason: 'subscription_update', hosted_invoice_url: 'https://example.test/steal' })
  await expect(existingSubscriptionFlow(input(2))).rejects.toMatchObject({ status: 409 })
})
it('recovers a lost paid increase response only from matching full-period invoice lines', async () => {
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...subscription(2), latest_invoice: 'in_paid' }] })
  sdk.invoices.retrieve.mockResolvedValue({ id: 'in_paid', customer: 'cus_addons', subscription: 'sub_addons',
    status: 'paid', billing_reason: 'subscription_update', lines: { has_more: false, data: [
      { pricing: { price_details: { price: base.id } }, quantity: 1, period: { start, end }, subscription: 'sub_addons' },
      { pricing: { price_details: { price: addon.id } }, quantity: 2, period: { start, end }, subscription: 'sub_addons' },
    ] } })
  expect(await existingSubscriptionFlow(input(2))).toEqual({ flow: 'prorated_addon', status: 'paid' })
  expect(sdk.subscriptions.update).not.toHaveBeenCalled()
})
it('schedules a reduction without changing existing connections or billing now', async () => {
  expect(await existingSubscriptionFlow(input(0))).toEqual({ flow: 'scheduled_addon_reduction',
    effectiveAt: new Date(end * 1000).toISOString() })
  expect(sdk.subscriptions.update).not.toHaveBeenCalled()
  expect(sdk.subscriptionSchedules.update).toHaveBeenCalledWith('sub_sched_addon', expect.objectContaining({
    end_behavior: 'release', proration_behavior: 'none', phases: expect.arrayContaining([
      expect.objectContaining({ start_date: end, items: [{ price: base.id, quantity: 1 }] }),
    ]),
  }), expect.any(Object))
})
it('recovers an already scheduled reduction without rewriting its phases', async () => {
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...subscription(), schedule: 'sub_sched_addon' }] })
  sdk.subscriptionSchedules.retrieve.mockResolvedValue(schedule(1, 0))
  expect(await existingSubscriptionFlow(input(0))).toMatchObject({ flow: 'scheduled_addon_reduction' })
  expect(beforeProviderWrite).not.toHaveBeenCalled()
})
it('retries a partial schedule write with the same provider keys', async () => {
  sdk.subscriptionSchedules.update.mockRejectedValueOnce(new Error('provider timeout'))
  await expect(existingSubscriptionFlow(input(0))).rejects.toThrow('provider timeout')
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...subscription(), schedule: 'sub_sched_addon' }] })
  expect(await existingSubscriptionFlow(input(0))).toMatchObject({ flow: 'scheduled_addon_reduction' })
  expect(sdk.subscriptionSchedules.create.mock.calls[0][1]).toEqual(sdk.subscriptionSchedules.create.mock.calls[1][1])
  expect(sdk.subscriptionSchedules.update).toHaveBeenCalledTimes(2)
})
it('refuses to replace a schedule containing tax rules or a foreign item', async () => {
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...subscription(), schedule: 'sub_sched_addon' }] })
  sdk.subscriptionSchedules.retrieve.mockResolvedValue({ ...schedule(), phases: [{ ...schedule().phases[0],
    items: [{ price: base.id, quantity: 1 }, { price: addon.id, quantity: 1, tax_rates: ['tx_1'] }] }] })
  await expect(existingSubscriptionFlow(input(0))).rejects.toMatchObject({ status: 409 })
  expect(sdk.subscriptionSchedules.update).not.toHaveBeenCalled()
})
it('rejects an unsafe schedule and a reduction below required connections', async () => {
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...subscription(), schedule: 'sub_sched_addon' }] })
  sdk.subscriptionSchedules.retrieve.mockResolvedValue({ ...schedule(), customer: 'cus_foreign' })
  await expect(existingSubscriptionFlow(input(0))).rejects.toMatchObject({ status: 409 })
  await expect(existingSubscriptionFlow({ ...input(0), requiredAddons: 1 })).rejects.toMatchObject({ status: 409 })
  expect(sdk.subscriptionSchedules.update).not.toHaveBeenCalled()
})
it('refuses plan changes with add-ons instead of dropping paid items', async () => {
  const other = price('price_addon_test_other', 50000)
  process.env.STRIPE_ENTERPRISE_PRICE_ID = other.id
  try {
    await expect(existingSubscriptionFlow({ ...input(1), price: other })).rejects.toMatchObject({ status: 409 })
    expect(sdk.subscriptions.update).not.toHaveBeenCalled()
  } finally { delete process.env.STRIPE_ENTERPRISE_PRICE_ID }
})