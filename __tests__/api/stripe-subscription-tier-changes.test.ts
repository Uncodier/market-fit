/** @jest-environment node */
import { randomUUID } from 'node:crypto'
import type Stripe from 'stripe'
import { existingSubscriptionFlow } from '@/app/api/stripe/checkout/subscription/subscription-update'

const siteId = randomUUID()
const start = Math.floor(Date.now() / 1000) - 86400
const end = start + 30 * 86400
const sdk = {
  customers: { retrieve: jest.fn() }, subscriptions: { list: jest.fn(), update: jest.fn() },
  invoices: { retrieve: jest.fn() },
  subscriptionSchedules: { create: jest.fn(), retrieve: jest.fn(), update: jest.fn() },
  billingPortal: { configurations: { retrieve: jest.fn() }, sessions: { create: jest.fn() } },
}
const beforeProviderWrite = jest.fn()
const prices = { engine: { id: 'price_engine', unit_amount: 2300 },
  foundry: { id: 'price_foundry', unit_amount: 9900 },
  enterprise: { id: 'price_enterprise', unit_amount: 50000 } }
function price(plan: keyof typeof prices): Stripe.Price {
  return { ...prices[plan], product: 'prod_platform', active: true, currency: 'usd', type: 'recurring',
    billing_scheme: 'per_unit', recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } } as Stripe.Price
}
function subscription(plan: keyof typeof prices = 'foundry') {
  return { id: 'sub_site', customer: 'cus_site', status: 'active', collection_method: 'charge_automatically',
    latest_invoice: 'in_previous',
    items: { has_more: false, data: [{ id: 'si_base', price: price(plan), quantity: 1,
      current_period_start: start, current_period_end: end }] } }
}
function schedule(phases: object[] = [{ start_date: start, end_date: end,
  items: [{ price: 'price_foundry', quantity: 1 }] }]) {
  return { id: 'sub_sched_site', subscription: 'sub_site', customer: 'cus_site',
    status: 'active', end_behavior: phases.length === 1 ? 'renew' : 'release',
    current_phase: { start_date: start, end_date: end }, phases }
}
function input(target: keyof typeof prices) {
  return { stripe: sdk as unknown as Stripe, customerId: 'cus_site', siteId, subscriptionId: 'sub_site',
    price: price(target), interval: 'month' as const, addonsCount: 0, returnUrl: 'https://example.test/billing',
    successUrl: 'https://example.test/billing/success', idempotencyKey: randomUUID(), beforeProviderWrite }
}
beforeEach(() => {
  jest.clearAllMocks()
  process.env.STRIPE_STARTER_PRICE_ID = prices.engine.id
  process.env.STRIPE_STARTUP_PRICE_ID = prices.foundry.id
  process.env.STRIPE_ENTERPRISE_PRICE_ID = prices.enterprise.id
  sdk.customers.retrieve.mockResolvedValue({ id: 'cus_site', metadata: { site_id: siteId } })
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [subscription()] })
  sdk.subscriptionSchedules.create.mockResolvedValue(schedule())
  sdk.subscriptionSchedules.retrieve.mockResolvedValue(schedule())
  sdk.subscriptionSchedules.update.mockResolvedValue({ ...schedule([
    { start_date: start, end_date: end, items: [{ price: 'price_foundry', quantity: 1 }] },
    { start_date: end, items: [{ price: 'price_engine', quantity: 1 }] }]),
    metadata: { downgrade_target: 'price_engine', downgrade_period_end: String(end) } })
  sdk.invoices.retrieve.mockResolvedValue({ id: 'in_previous', customer: 'cus_site', subscription: 'sub_site', status: 'paid' })
  sdk.subscriptions.update.mockResolvedValue({ id: 'sub_site', customer: 'cus_site', latest_invoice: { status: 'paid' }, pending_update: null })
})
afterAll(() => {
  delete process.env.STRIPE_STARTER_PRICE_ID
  delete process.env.STRIPE_STARTUP_PRICE_ID
  delete process.env.STRIPE_ENTERPRISE_PRICE_ID
})
it('schedules the cheaper tier at renewal without prorating or changing the current plan', async () => {
  const request = input('engine')
  expect(await existingSubscriptionFlow(request)).toEqual({ flow: 'scheduled_downgrade',
    effectiveAt: new Date(end * 1000).toISOString() })
  expect(sdk.subscriptionSchedules.create).toHaveBeenCalledWith({ from_subscription: 'sub_site' }, expect.any(Object))
  expect(sdk.subscriptionSchedules.update).toHaveBeenCalledWith('sub_sched_site', {
    end_behavior: 'release', proration_behavior: 'none', metadata: {
      downgrade_target: 'price_engine', downgrade_period_end: String(end) }, phases: [
      { start_date: start, end_date: end, items: [{ price: 'price_foundry', quantity: 1 }], proration_behavior: 'none' },
      { start_date: end, items: [{ price: 'price_engine', quantity: 1 }], iterations: 1, proration_behavior: 'none' },
    ],
  }, expect.any(Object))
  expect(sdk.subscriptions.update).not.toHaveBeenCalled()
  expect(beforeProviderWrite).toHaveBeenCalledTimes(2)
})
it('bills a same-interval upgrade now with Stripe unused-time credit and pending payment safety', async () => {
  const result = await existingSubscriptionFlow(input('enterprise'))
  expect(result).toEqual({ flow: 'prorated_upgrade', status: 'paid' })
  expect(sdk.subscriptions.update).toHaveBeenCalledWith('sub_site', {
    items: [{ id: 'si_base', price: 'price_enterprise', quantity: 1 }], billing_cycle_anchor: 'now',
    proration_behavior: 'always_invoice', payment_behavior: 'pending_if_incomplete', expand: ['latest_invoice'],
  }, expect.any(Object))
  expect(sdk.subscriptionSchedules.create).not.toHaveBeenCalled()
  expect(beforeProviderWrite).toHaveBeenCalledTimes(1)
})
it('preserves redeemed discounts on a same-interval upgrade instead of replaying coupons', async () => {
  sdk.subscriptions.list.mockResolvedValueOnce({ data: [{ ...subscription(), discounts: ['di_previous'] }], has_more: false })
  await expect(existingSubscriptionFlow(input('enterprise'))).resolves.toMatchObject({ flow: 'prorated_upgrade', status: 'paid' })
  expect(sdk.subscriptions.update.mock.calls[0][1]).not.toHaveProperty('discounts')
})
it('does not claim an unpaid upgrade is active', async () => {
  sdk.subscriptions.update.mockResolvedValue({ id: 'sub_site', customer: 'cus_site', latest_invoice: 'in_upgrade',
    pending_update: { expires_at: end, subscription_items: [{ price: price('enterprise'), quantity: 1 }] } })
  sdk.invoices.retrieve.mockImplementation(async id => id === 'in_previous'
    ? { id, customer: 'cus_site', subscription: 'sub_site', status: 'paid' }
    : { id, customer: 'cus_site', subscription: 'sub_site', status: 'open', billing_reason: 'subscription_update',
      hosted_invoice_url: 'https://invoice.stripe.com/i/test-pay' })
  expect(await existingSubscriptionFlow(input('enterprise'))).toEqual({ flow: 'prorated_upgrade',
    status: 'pending_payment', url: 'https://invoice.stripe.com/i/test-pay' })
})
it('allows a later retry to complete a pending upgrade through its verified invoice', async () => {
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...subscription(),
    latest_invoice: 'in_upgrade', pending_update: { expires_at: end,
      subscription_items: [{ price: price('enterprise'), quantity: 1 }] } }] })
  sdk.invoices.retrieve.mockResolvedValue({ id: 'in_upgrade', customer: 'cus_site', subscription: 'sub_site',
    billing_reason: 'subscription_update', status: 'open',
    hosted_invoice_url: 'https://invoice.stripe.com/i/test-pay' })
  expect(await existingSubscriptionFlow(input('enterprise'))).toEqual({ flow: 'prorated_upgrade',
    status: 'pending_payment', url: 'https://invoice.stripe.com/i/test-pay' })
  expect(sdk.subscriptions.update).not.toHaveBeenCalled()
})
it.each(['https://evil.example.test/i/phish', 'http://invoice.stripe.com/i/unsecured', null])(
  'refuses an untrusted or missing pending invoice payment URL %s', async url => {
    sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...subscription(),
      pending_update: { expires_at: end, subscription_items: [{ price: price('enterprise'), quantity: 1 }] },
      latest_invoice: 'in_upgrade' }] })
    sdk.invoices.retrieve.mockResolvedValue({ id: 'in_upgrade', customer: 'cus_site', subscription: 'sub_site',
      status: 'open', billing_reason: 'subscription_update', hosted_invoice_url: url })
    await expect(existingSubscriptionFlow(input('enterprise'))).rejects.toMatchObject({ status: 409 })
    expect(sdk.subscriptions.update).not.toHaveBeenCalled()
  })
it.each([{ automatic_tax: { enabled: true } }, { default_tax_rates: [{ id: 'tx_1' }] },
  { items: { has_more: false, data: [{ ...subscription().items.data[0], tax_rates: [{ id: 'tx_2' }] }] } }])(
  'rejects downgrades that cannot copy tax settings %#', async override => {
    sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...subscription(), ...override }] })
    await expect(existingSubscriptionFlow(input('engine'))).rejects.toMatchObject({ status: 409 })
    expect(sdk.subscriptionSchedules.create).not.toHaveBeenCalled()
  })
it('finishes a partial downgrade after a schedule was attached without recreating it', async () => {
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...subscription(), schedule: 'sub_sched_site' }] })
  expect(await existingSubscriptionFlow(input('engine'))).toEqual({ flow: 'scheduled_downgrade',
    effectiveAt: new Date(end * 1000).toISOString() })
  expect(sdk.subscriptionSchedules.retrieve).toHaveBeenCalledWith('sub_sched_site')
  expect(sdk.subscriptionSchedules.create).toHaveBeenCalledTimes(1)
  expect(sdk.subscriptionSchedules.update).toHaveBeenCalledTimes(1)
})
it('recovers when creating a schedule worked but its phase update failed', async () => {
  sdk.subscriptionSchedules.update.mockRejectedValueOnce(new Error('provider timeout'))
  await expect(existingSubscriptionFlow(input('engine'))).rejects.toThrow('provider timeout')
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...subscription(), schedule: 'sub_sched_site' }] })
  expect(await existingSubscriptionFlow(input('engine'))).toMatchObject({ flow: 'scheduled_downgrade' })
  expect(sdk.subscriptionSchedules.retrieve).toHaveBeenCalledWith('sub_sched_site')
  expect(sdk.subscriptionSchedules.update).toHaveBeenCalledTimes(2)
  expect(sdk.subscriptionSchedules.create.mock.calls[0][1]).toEqual(sdk.subscriptionSchedules.create.mock.calls[1][1])
})
it('acknowledges an already configured downgrade without writing again', async () => {
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...subscription(), schedule: 'sub_sched_site' }] })
  sdk.subscriptionSchedules.retrieve.mockResolvedValue({ ...schedule([
    { start_date: start, end_date: end, items: [{ price: 'price_foundry', quantity: 1 }] },
    { start_date: end, items: [{ price: 'price_engine', quantity: 1 }] }]),
    metadata: { downgrade_target: 'price_engine', downgrade_period_end: String(end) } })
  expect(await existingSubscriptionFlow(input('engine'))).toMatchObject({ flow: 'scheduled_downgrade' })
  expect(beforeProviderWrite).not.toHaveBeenCalled()
})
it('rejects a foreign or changed attached schedule without overwriting it', async () => {
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...subscription(), schedule: 'sub_sched_site' }] })
  sdk.subscriptionSchedules.retrieve.mockResolvedValue({ ...schedule(), customer: 'cus_other' })
  await expect(existingSubscriptionFlow(input('engine'))).rejects.toMatchObject({ status: 409 })
  expect(sdk.subscriptionSchedules.update).not.toHaveBeenCalled()
})

it('copies redeemed discounts by ID rather than reapplying coupons on a downgrade', async () => {
  sdk.subscriptions.list.mockResolvedValue({ data: [{ ...subscription(), discounts: ['di_original'] }], has_more: false })
  const kept = { ...schedule(), phases: schedule().phases.map(phase => ({ ...phase, discounts: [{ discount: 'di_original' }] })) }
  sdk.subscriptionSchedules.create.mockResolvedValue(kept)
  sdk.subscriptionSchedules.update.mockImplementation(async (_id, update) => ({ ...kept, ...update, status: 'active' }))
  await expect(existingSubscriptionFlow(input('engine'))).resolves.toMatchObject({ flow: 'scheduled_downgrade' })
  for (const phase of sdk.subscriptionSchedules.update.mock.calls[0][1].phases) {
    expect(phase.discounts).toEqual([{ discount: 'di_original' }])
  }
})
it('recovers a lost upgrade response only with a matching paid full-period update invoice', async () => {
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...subscription('enterprise'),
    latest_invoice: 'in_upgrade' }] })
  sdk.invoices.retrieve.mockResolvedValue({ id: 'in_upgrade', customer: 'cus_site', subscription: 'sub_site',
    status: 'paid', billing_reason: 'subscription_update', lines: { has_more: false, data: [{
      pricing: { price_details: { price: 'price_enterprise' } }, quantity: 1,
      period: { start, end }, subscription: 'sub_site' }] } })
  expect(await existingSubscriptionFlow(input('enterprise'))).toEqual({ flow: 'prorated_upgrade', status: 'paid' })
  expect(sdk.subscriptions.update).not.toHaveBeenCalled()
})
it('does not accept an unrelated paid invoice as upgrade recovery', async () => {
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...subscription('enterprise'),
    latest_invoice: 'in_upgrade' }] })
  sdk.invoices.retrieve.mockResolvedValue({ id: 'in_upgrade', customer: 'cus_site', subscription: 'sub_site',
    status: 'paid', billing_reason: 'subscription_cycle' })
  await expect(existingSubscriptionFlow(input('enterprise'))).rejects.toMatchObject({ status: 409 })
})
it.each([{ status: 'open', customer: 'cus_site' }, { status: 'paid', customer: 'cus_other' }])(
  'does not credit an unpaid or foreign previous invoice %#', async invoice => {
    sdk.invoices.retrieve.mockResolvedValue({ id: 'in_previous', subscription: 'sub_site', ...invoice })
    await expect(existingSubscriptionFlow(input('enterprise'))).rejects.toMatchObject({ status: 409 })
    expect(sdk.subscriptions.update).not.toHaveBeenCalled()
  })
it('does not credit another subscription’s paid invoice', async () => {
  sdk.invoices.retrieve.mockResolvedValue({ id: 'in_previous', customer: 'cus_site', subscription: 'sub_other', status: 'paid' })
  await expect(existingSubscriptionFlow(input('enterprise'))).rejects.toMatchObject({ status: 409 })
  expect(sdk.subscriptions.update).not.toHaveBeenCalled()
})
it('does not credit an invoice with conflicting subscription identities', async () => {
  sdk.invoices.retrieve.mockResolvedValue({ id: 'in_previous', customer: 'cus_site', subscription: 'sub_site',
    parent: { subscription_details: { subscription: 'sub_other' } }, status: 'paid' })
  await expect(existingSubscriptionFlow(input('enterprise'))).rejects.toMatchObject({ status: 409 })
  expect(sdk.subscriptions.update).not.toHaveBeenCalled()
})
it.each([ { pending_update: {} }, { cancel_at_period_end: true },
  { discounts: [{ id: 'coupon_wrong_object' }] }, { collection_method: 'send_invoice' },
  { items: { has_more: false, data: [{ ...subscription().items.data[0], quantity: 2 }] } },
])('rejects unsafe downgrade state without touching Stripe %#', async (override) => {
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...subscription(), ...override }] })
  await expect(existingSubscriptionFlow(input('engine'))).rejects.toMatchObject({ status: 409 })
  expect(beforeProviderWrite).not.toHaveBeenCalled()
  expect(sdk.subscriptionSchedules.create).not.toHaveBeenCalled()
  expect(sdk.subscriptions.update).not.toHaveBeenCalled()
})
it('does not schedule a change if the provider period cannot be verified', async () => {
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [{ ...subscription(),
    items: { has_more: false, data: [{ ...subscription().items.data[0], current_period_end: undefined }] } }] })
  await expect(existingSubscriptionFlow(input('engine'))).rejects.toMatchObject({ status: 409 })
  expect(sdk.subscriptionSchedules.create).not.toHaveBeenCalled()
})
it('does not change an active subscription without a stored subscription binding', async () => {
  await expect(existingSubscriptionFlow({ ...input('engine'), subscriptionId: null })).rejects.toMatchObject({ status: 409 })
  expect(sdk.subscriptionSchedules.create).not.toHaveBeenCalled()
  expect(sdk.subscriptions.update).not.toHaveBeenCalled()
})
it('does not claim an unverified schedule was successfully configured', async () => {
  sdk.subscriptionSchedules.create.mockResolvedValue({ id: 'sub_sched_site', subscription: 'sub_other', status: 'active' })
  await expect(existingSubscriptionFlow(input('engine'))).rejects.toMatchObject({ status: 409 })
  expect(sdk.subscriptionSchedules.update).not.toHaveBeenCalled()
})
it('does not report an incomplete future phase as scheduled', async () => {
  sdk.subscriptionSchedules.update.mockResolvedValue({ id: 'sub_sched_site', subscription: 'sub_site', status: 'active', phases: [] })
  await expect(existingSubscriptionFlow(input('engine'))).rejects.toMatchObject({ status: 409 })
})