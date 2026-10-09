/** @jest-environment node */
import { randomBytes, randomUUID } from 'node:crypto'
import Stripe from 'stripe'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceApiClient } from '@/lib/supabase/server-client'
import { POST } from '@/app/api/stripe/checkout/subscription/route'
import { configuredSubscriptionPrices } from '@/lib/subscription-pricing.server'

jest.mock('stripe', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/supabase/server-client', () => ({ createServiceApiClient: jest.fn() }))
jest.mock('@/lib/redis/control-plane', () => ({
  checkRateLimit: jest.fn(async () => ({ allowed: true })), hashRedisKeyPart: jest.fn(async (part) => part),
}))

const siteId = randomUUID()
const userId = randomUUID()
const origin = 'https://checkout.example.test'
const from = jest.fn()
const rpc = jest.fn()
const auth = { getUser: jest.fn() }
const leaseRpc = jest.fn()
const sdk = {
  prices: { retrieve: jest.fn() },
  invoices: { retrieve: jest.fn() },
  customers: { create: jest.fn(), retrieve: jest.fn() },
  subscriptions: { list: jest.fn(), retrieve: jest.fn(), update: jest.fn() },
  checkout: { sessions: { list: jest.fn(), retrieve: jest.fn(), expire: jest.fn(), create: jest.fn() } },
  billingPortal: { configurations: { retrieve: jest.fn() }, sessions: { create: jest.fn() } },
}
const keys = ['STRIPE_STARTER_PRICE_ID', 'STRIPE_STARTUP_PRICE_ID', 'STRIPE_ENTERPRISE_PRICE_ID',
  'STRIPE_ACCOUNT_ADDON_PRICE_ID', 'STRIPE_STARTER_ANNUAL_PRICE_ID', 'STRIPE_STARTUP_ANNUAL_PRICE_ID',
  'STRIPE_ENTERPRISE_ANNUAL_PRICE_ID', 'STRIPE_ACCOUNT_ADDON_ANNUAL_PRICE_ID']

function price(id: string) {
  const config = configuredSubscriptionPrices().find((item) => item.priceId === id)!
  return { id, product: 'prod_platform', active: true, currency: 'usd', type: 'recurring',
    recurring: { interval: config.interval, interval_count: 1, usage_type: 'licensed' },
    unit_amount: config.amount, billing_scheme: 'per_unit' }
}
function request(body: unknown = {}, authenticated = true) {
  const url = new URL('/api/stripe/checkout/subscription', origin)
  return new NextRequest(url, { method: 'POST', headers: { origin, 'content-type': 'application/json',
    ...(authenticated ? { authorization: `Bearer ${randomBytes(24).toString('hex')}` } : {}) },
  body: JSON.stringify({ siteId, plan: 'engine', successUrl: `${origin}/billing?success=true`,
    cancelUrl: `${origin}/billing`, ...(body as object) }) })
}
function existing(overrides = {}) {
  const sub = { id: 'sub_existing', customer: 'cus_site', status: 'active', metadata: { plan: 'engine' },
    items: { has_more: false, data: [{ id: 'si_base', price: price('price_0'), quantity: 1 }] }, ...overrides }
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [sub] })
  from.mockImplementation(() => ({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(async () => ({ data: { stripe_customer_id: 'cus_site', stripe_subscription_id: 'sub_existing' }, error: null })) }))
}
beforeEach(() => {
  jest.clearAllMocks()
  keys.forEach((key, index) => { process.env[key] = `price_${index}` })
  process.env.STRIPE_SECRET_KEY = randomBytes(24).toString('hex')
  process.env.CHECKOUT_RETURN_ORIGINS = origin
  process.env.STRIPE_SUBSCRIPTION_UPDATE_PORTAL_CONFIGURATION_ID = 'bpc_safe'
  process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID = 'bpc_generic'
  jest.mocked(Stripe).mockImplementation(() => sdk as unknown as Stripe)
  jest.mocked(createClient).mockResolvedValue({ auth, from, rpc } as unknown as Awaited<ReturnType<typeof createClient>>)
  jest.mocked(createServiceApiClient).mockReturnValue({ rpc: leaseRpc } as unknown as ReturnType<typeof createServiceApiClient>)
  leaseRpc.mockImplementation(async (name) => ({ data: name === 'claim_site_subscription_checkout'
    ? { state: 'claimed', token: randomUUID() } : name === 'upsert_billing' ? { success: true } : true, error: null }))
  auth.getUser.mockResolvedValue({ data: { user: { id: userId, email: 'owner@example.test' } }, error: null })
  rpc.mockImplementation(async (name) => ({ data: name === 'current_user_site_role' ? 'owner' : { success: true }, error: null }))
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(async () => ({ data: { stripe_customer_id: 'cus_site' }, error: null })) }
  from.mockReturnValue(query)
  sdk.prices.retrieve.mockImplementation(async (id) => price(id))
  sdk.invoices.retrieve.mockResolvedValue({ id: 'in_previous', customer: 'cus_site', subscription: 'sub_existing', status: 'paid' })
  sdk.customers.retrieve.mockResolvedValue({ id: 'cus_site', metadata: { site_id: siteId } })
  sdk.customers.create.mockResolvedValue({ id: 'cus_site' })
  sdk.subscriptions.list.mockResolvedValue({ has_more: false, data: [] })
  sdk.checkout.sessions.list.mockResolvedValue({ has_more: false, data: [] })
  sdk.checkout.sessions.create.mockResolvedValue({ id: 'cs_payment', status: 'open', url: 'https://pay.example.test/checkout' })
  sdk.billingPortal.configurations.retrieve.mockResolvedValue({ id: 'bpc_safe', active: true, is_default: false, features: {
    subscription_update: { enabled: true, default_allowed_updates: ['price'], proration_behavior: 'always_invoice',
      schedule_at_period_end: { conditions: [] }, products: [{ product: 'prod_platform', prices: ['price_4'] }] } } })
  sdk.billingPortal.sessions.create.mockResolvedValue({ id: 'bps_confirm', url: 'https://portal.example.test/confirm' })
})
afterAll(() => { keys.forEach((key) => delete process.env[key]); delete process.env.STRIPE_SECRET_KEY; delete process.env.CHECKOUT_RETURN_ORIGINS
  delete process.env.STRIPE_SUBSCRIPTION_UPDATE_PORTAL_CONFIGURATION_ID; delete process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID })

describe('subscription auth, input, and server pricing', () => {
  it.each(['month', 'year'])('creates Free add-ons using only the configured %s extra price', async billingInterval => {
    expect((await POST(request({ plan: 'commission', addonsCount: 2, billingInterval }))).status).toBe(200)
    const addonId = billingInterval === 'year' ? 'price_7' : 'price_3'
    expect(sdk.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      line_items: [{ price: addonId, quantity: 2 }],
      metadata: { site_id: siteId, plan: 'commission', billing_interval: billingInterval,
        addons_count: '2', type: 'subscription', price_id: '', addon_price_id: addonId },
    }), expect.objectContaining({ idempotencyKey: expect.any(String) }))
    expect(sdk.prices.retrieve).toHaveBeenCalledTimes(1)
    expect(sdk.prices.retrieve).toHaveBeenCalledWith(addonId)
  })
  it('does not start an empty Free subscription or create a customer at zero', async () => {
    expect((await POST(request({ plan: 'commission', addonsCount: 0 }))).status).toBe(400)
    expect(sdk.customers.create).not.toHaveBeenCalled()
    expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it('rejects Free checkout that would drop an active paid base', async () => {
    existing()
    expect((await POST(request({ plan: 'commission', addonsCount: 1 }))).status).toBe(409)
    expect(sdk.subscriptions.update).not.toHaveBeenCalled()
    expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it('requires the configured active Free extra price, even without any base configuration', async () => {
    keys.filter(key => !key.includes('ADDON')).forEach(key => delete process.env[key])
    expect((await POST(request({ plan: 'commission', addonsCount: 1 }))).status).toBe(200)
    sdk.prices.retrieve.mockResolvedValue({ ...price('price_3'), unit_amount: 0 })
    expect((await POST(request({ plan: 'commission', addonsCount: 1 }))).status).toBe(503)
    expect(sdk.checkout.sessions.create).toHaveBeenCalledTimes(1)
  })
  it('rejects unauthenticated before SDK or billing access', async () => {
    expect((await POST(request({}, false))).status).toBe(401)
    expect(Stripe).not.toHaveBeenCalled(); expect(from).not.toHaveBeenCalled()
  })
  it.each(['collaborator', 'marketing', null])('rejects unauthorized/cross-site role %s', async (role) => {
    rpc.mockResolvedValue({ data: role, error: null })
    expect((await POST(request())).status).toBe(403)
    expect(Stripe).not.toHaveBeenCalled()
  })
  it.each([{ plan: 'starter' }, { siteId: '' }, { billingInterval: 'quarter' }, { billingInterval: null },
    { addonsCount: '2junk' }, { addonsCount: 1.5 }, { addonsCount: -1 }, { addonsCount: 101 },
    { cancelUrl: 'https://untrusted.example.test' }])('rejects malformed input %# before price access', async (body) => {
    expect((await POST(request(body))).status).toBe(400)
    expect(sdk.prices.retrieve).not.toHaveBeenCalled()
  })
  it('rejects malformed JSON', async () => {
    const bad = new NextRequest(new URL('/api/stripe/checkout/subscription', origin), { method: 'POST', body: '{' })
    expect((await POST(bad)).status).toBe(400)
  })
  it.each(['engine', 'foundry', 'enterprise'])('defaults old %s callers to monthly with promotions', async (plan) => {
    expect((await POST(request({ plan }))).status).toBe(200)
    const input = sdk.checkout.sessions.create.mock.calls[0][0]
    expect(input).toMatchObject({ mode: 'subscription', allow_promotion_codes: true,
      metadata: { plan, billing_interval: 'month', addons_count: '0' }, subscription_data: { metadata: { billing_interval: 'month' } } })
    expect(rpc.mock.calls.filter(([name]) => name === 'upsert_billing')).toHaveLength(0)
  })
  it.each([['engine', 24840], ['foundry', 106920], ['enterprise', 540000]])('validates %s annual + $108 addon prices', async (plan, amount) => {
    expect((await POST(request({ plan, billingInterval: 'year', addonsCount: 2 }))).status).toBe(200)
    const input = sdk.checkout.sessions.create.mock.calls[0][0]
    expect(price(input.line_items[0].price).unit_amount).toBe(amount)
    expect(input.line_items[1]).toEqual({ price: 'price_7', quantity: 2 })
    expect(price('price_7').unit_amount).toBe(10800)
    expect(input.metadata.billing_interval).toBe('year')
  })
  it('fails missing annual config without dummy/monthly fallback', async () => {
    delete process.env.STRIPE_STARTER_ANNUAL_PRICE_ID
    expect((await POST(request({ billingInterval: 'year' }))).status).toBe(503)
    expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it('rejects a missing annual addon price before customer or session creation', async () => {
    delete process.env.STRIPE_ACCOUNT_ADDON_ANNUAL_PRICE_ID
    expect((await POST(request({ billingInterval: 'year', addonsCount: 1 }))).status).toBe(503)
    expect(sdk.customers.create).not.toHaveBeenCalled(); expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it('rejects ambiguous configured prices', async () => {
    process.env.STRIPE_STARTER_ANNUAL_PRICE_ID = process.env.STRIPE_STARTER_PRICE_ID
    expect((await POST(request({ billingInterval: 'year' }))).status).toBe(503)
    expect(sdk.prices.retrieve).not.toHaveBeenCalled()
  })
  it.each([{ active: false }, { currency: 'eur' }, { unit_amount: 2300 },
    { recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' } }])('rejects wrong live annual price %#', async (override) => {
    sdk.prices.retrieve.mockResolvedValue({ ...price('price_4'), ...override })
    expect((await POST(request({ billingInterval: 'year' }))).status).toBe(503)
    expect(sdk.customers.create).not.toHaveBeenCalled(); expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it('includes interval in stable retry idempotency', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1800000000000)
    await POST(request()); await POST(request()); await POST(request({ billingInterval: 'year' }))
    const ids = sdk.checkout.sessions.create.mock.calls.map(([, options]) => options.idempotencyKey)
    expect(ids[0]).toBe(ids[1]); expect(ids[2]).not.toBe(ids[0])
    jest.restoreAllMocks()
  })
  it('does not leak provider errors or synthetic credential values', async () => {
    const sensitive = randomBytes(24).toString('hex')
    sdk.prices.retrieve.mockRejectedValue(new Error(sensitive))
    const response = await POST(request())
    expect(response.status).toBe(503); expect(await response.text()).not.toContain(sensitive)
  })
  it('persists only the new customer through authorized service access, not browser financial RPC', async () => {
    from().maybeSingle.mockResolvedValue({ data: null, error: null })
    expect((await POST(request())).status).toBe(200)
    expect(leaseRpc).toHaveBeenCalledWith('upsert_billing', { p_site_id: siteId, p_stripe_customer_id: 'cus_site' })
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(['current_user_site_role'])
    expect(leaseRpc.mock.calls.at(-1)[0]).toBe('finish_site_subscription_checkout')
  })
})

describe('existing subscriptions and checkout retries', () => {
  it('blocks concurrent site checkout when the durable lease is busy', async () => {
    leaseRpc.mockResolvedValue({ data: { state: 'busy', token: null }, error: null })
    const response = await POST(request())
    expect(response.status).toBe(503); expect(response.headers.get('Retry-After')).toBe('300')
    expect(sdk.subscriptions.list).not.toHaveBeenCalled(); expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it('retains lease after ambiguous Stripe creation failure, releases only confirmed success', async () => {
    sdk.checkout.sessions.create.mockRejectedValueOnce(new Error('transport unavailable'))
    const response = await POST(request())
    expect(response.status).toBe(503); expect(response.headers.get('Retry-After')).toBe('300')
    expect(leaseRpc.mock.calls.map(([name]) => name)).toEqual(['claim_site_subscription_checkout'])
    await POST(request())
    expect(leaseRpc.mock.calls.map(([name]) => name)).toEqual([
      'claim_site_subscription_checkout', 'claim_site_subscription_checkout', 'finish_site_subscription_checkout'])
  })
  it.each(['complete', 'expired'])('rejects an idempotent creation replay that is already %s', async status => {
    sdk.checkout.sessions.create.mockResolvedValueOnce({ id: 'cs_replay', status, url: null })
    expect((await POST(request())).status).toBe(409)
    expect(sdk.checkout.sessions.create).toHaveBeenCalledTimes(1)
  })
  it('does not write after a delayed lease read consumes the provider-write deadline', async () => {
    let now = 1800000000000
    jest.spyOn(Date, 'now').mockImplementation(() => now)
    sdk.subscriptions.list.mockImplementation(async () => {
      now += 4 * 60 * 1000
      return { has_more: false, data: [] }
    })
    try {
      expect((await POST(request())).status).toBe(503)
      expect(sdk.checkout.sessions.expire).not.toHaveBeenCalled(); expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
    } finally { jest.restoreAllMocks() }
  })
  it('returns hosted confirmation for single-base monthly-to-year without mutation', async () => {
    existing()
    const response = await POST(request({ billingInterval: 'year' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ url: 'https://portal.example.test/confirm', flow: 'subscription_update_confirm' })
    expect(sdk.billingPortal.configurations.retrieve).toHaveBeenCalledWith('bpc_safe')
    expect(sdk.billingPortal.sessions.create.mock.calls[0][0]).toMatchObject({ customer: 'cus_site', configuration: 'bpc_safe',
      flow_data: { type: 'subscription_update_confirm', subscription_update_confirm: {
        subscription: 'sub_existing', items: [{ id: 'si_base', price: 'price_4', quantity: 1 }] } } })
    expect(sdk.subscriptions.update).not.toHaveBeenCalled(); expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it('supports year-to-month through the same hosted confirmation contract', async () => {
    existing({ items: { has_more: false, data: [{ id: 'si_base', price: price('price_4'), quantity: 1 }] } })
    sdk.billingPortal.configurations.retrieve.mockResolvedValue({ id: 'bpc_safe', active: true, is_default: false, features: {
      subscription_update: { enabled: true, default_allowed_updates: ['price'], proration_behavior: 'always_invoice',
        schedule_at_period_end: { conditions: [] }, products: [{ product: 'prod_platform', prices: ['price_0'] }] } } })
    expect((await POST(request({ billingInterval: 'month' }))).status).toBe(200)
    expect(sdk.billingPortal.sessions.create.mock.calls[0][0].flow_data.subscription_update_confirm.items[0].price).toBe('price_0')
    expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it.each([{ status: 'past_due' }, { pending_update: {} }, { schedule: 'sched_pending' }, { cancel_at_period_end: true },
    { items: { has_more: true, data: [] } }, { items: { has_more: false, data: [
      { id: 'si_base', price: { id: 'price_0' } }, { id: 'si_addon', price: { id: 'price_3' } }] } }])('blocks unsuitable subscription %#', async (override) => {
    existing(override)
    expect([409, 503]).toContain((await POST(request({ billingInterval: 'year' }))).status)
    expect(sdk.checkout.sessions.create).not.toHaveBeenCalled(); expect(sdk.billingPortal.sessions.create).not.toHaveBeenCalled()
  })
  it('rejects addon update rather than creating a second subscription', async () => {
    existing()
    expect((await POST(request({ billingInterval: 'year', addonsCount: 1 }))).status).toBe(409)
    expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it('rejects same-interval tier change pending deliberate proration recovery', async () => {
    existing()
    expect((await POST(request({ plan: 'foundry' }))).status).toBe(409)
    expect(sdk.checkout.sessions.create).not.toHaveBeenCalled(); expect(sdk.billingPortal.sessions.create).not.toHaveBeenCalled()
  })
  it('requires safe live portal config, never changes it', async () => {
    existing(); sdk.billingPortal.configurations.retrieve.mockResolvedValue({ id: 'bpc_safe', active: false })
    expect((await POST(request({ billingInterval: 'year' }))).status).toBe(409)
    expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it('rejects a customer belonging to another site', async () => {
    sdk.customers.retrieve.mockResolvedValue({ metadata: { site_id: randomUUID() } })
    expect((await POST(request())).status).toBe(409)
    expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it('reuses same open checkout and expires/replaces another interval selection', async () => {
    await POST(request())
    const input = sdk.checkout.sessions.create.mock.calls[0][0]
    const pending = { ...input, id: 'cs_pending', status: 'open', url: 'https://pay.example.test/pending' }
    sdk.checkout.sessions.list.mockImplementation(async () => ({ has_more: false, data: [pending] }))
    sdk.checkout.sessions.retrieve.mockImplementation(async () => ({ ...pending }))
    sdk.checkout.sessions.expire.mockImplementation(async () => { pending.status = 'expired'; return { ...pending } })
    expect(await (await POST(request())).json()).toMatchObject({ sessionId: 'cs_pending' })
    expect(sdk.checkout.sessions.expire).not.toHaveBeenCalled()
    expect((await POST(request({ billingInterval: 'year' }))).status).toBe(200)
    expect(sdk.checkout.sessions.expire).toHaveBeenCalledWith('cs_pending')
    expect(sdk.checkout.sessions.create).toHaveBeenCalledTimes(2)
    expect(sdk.checkout.sessions.create.mock.calls[1][0].metadata.billing_interval).toBe('year')
    expect(leaseRpc.mock.calls.at(-1)[0]).toBe('finish_site_subscription_checkout')
  })
  it.each(['complete', 'expired'])('rejects a pending session that raced to %s before expiration', async (status) => {
    sdk.checkout.sessions.list.mockResolvedValue({ has_more: false, data: [{ mode: 'subscription', status: 'open', id: 'cs_race' }] })
    sdk.checkout.sessions.retrieve.mockResolvedValue({ mode: 'subscription', status, customer: 'cus_site', metadata: { site_id: siteId, type: 'subscription' } })
    expect((await POST(request())).status).toBe(409)
    expect(sdk.checkout.sessions.expire).not.toHaveBeenCalled(); expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it('retains the lease and never creates after an ambiguous expiration failure', async () => {
    sdk.checkout.sessions.list.mockResolvedValue({ has_more: false, data: [{ mode: 'subscription', status: 'open', id: 'cs_old' }] })
    sdk.checkout.sessions.retrieve.mockResolvedValue({ id: 'cs_old', mode: 'subscription', status: 'open', customer: 'cus_site', metadata: { site_id: siteId, type: 'subscription' } })
    sdk.checkout.sessions.expire.mockRejectedValueOnce(new Error('transport unavailable'))
    const response = await POST(request())
    expect(response.status).toBe(503); expect(response.headers.get('Retry-After')).toBe('300')
    expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
    expect(leaseRpc.mock.calls.map(([name]) => name)).toEqual(['claim_site_subscription_checkout'])
  })
  it('never creates when expiration raced with completion', async () => {
    sdk.checkout.sessions.list.mockResolvedValue({ has_more: false, data: [{ mode: 'subscription', status: 'open', id: 'cs_old' }] })
    sdk.checkout.sessions.retrieve.mockResolvedValue({ id: 'cs_old', mode: 'subscription', status: 'open', customer: 'cus_site', metadata: { site_id: siteId, type: 'subscription' } })
    sdk.checkout.sessions.expire.mockResolvedValueOnce({ id: 'cs_old', status: 'complete' })
    expect((await POST(request())).status).toBe(409)
    expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it('never expires an open checkout belonging to another site', async () => {
    sdk.checkout.sessions.list.mockResolvedValue({ has_more: false, data: [{ mode: 'subscription', status: 'open', id: 'cs_foreign' }] })
    sdk.checkout.sessions.retrieve.mockResolvedValue({ id: 'cs_foreign', mode: 'subscription', status: 'open', customer: 'cus_site', metadata: { site_id: randomUUID(), type: 'subscription' } })
    expect((await POST(request())).status).toBe(409)
    expect(sdk.checkout.sessions.expire).not.toHaveBeenCalled(); expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it('does not replace when session history is paginated', async () => {
    sdk.checkout.sessions.list.mockResolvedValue({ has_more: true, data: [] })
    expect((await POST(request())).status).toBe(409)
    expect(sdk.checkout.sessions.expire).not.toHaveBeenCalled(); expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it('uses a new checkout idempotency generation when revisiting a replaced selection', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1800000000000)
    const sessions: Array<Record<string, unknown>> = []
    sdk.checkout.sessions.list.mockImplementation(async () => ({ has_more: false, data: sessions.map(session => ({ ...session })) }))
    sdk.checkout.sessions.retrieve.mockImplementation(async id => ({ ...sessions.find(session => session.id === id) }))
    sdk.checkout.sessions.expire.mockImplementation(async id => {
      const session = sessions.find(session => session.id === id)!
      session.status = 'expired'; return { ...session }
    })
    sdk.checkout.sessions.create.mockImplementation(async input => {
      const session = { ...input, id: `cs_generation_${sessions.length}`, status: 'open', url: 'https://pay.example.test/checkout' }
      sessions.push(session); return session
    })
    try {
      expect((await POST(request())).status).toBe(200)
      expect((await POST(request({ billingInterval: 'year' }))).status).toBe(200)
      expect((await POST(request())).status).toBe(200)
      const ids = sdk.checkout.sessions.create.mock.calls.map(([, options]) => options.idempotencyKey)
      expect(new Set(ids).size).toBe(3)
      expect(sdk.checkout.sessions.expire).toHaveBeenCalledTimes(2)
      expect(sessions.map(session => session.status)).toEqual(['expired', 'expired', 'open'])
    } finally { jest.restoreAllMocks() }
  })
  it('rejects completed checkout before its subscription is visible in the list', async () => {
    sdk.checkout.sessions.list.mockResolvedValue({ has_more: false, data: [{ id: 'cs_paid', mode: 'subscription', status: 'complete',
      customer: 'cus_site', subscription: 'sub_racing', metadata: { site_id: siteId, type: 'subscription' } }] })
    sdk.subscriptions.retrieve.mockResolvedValue({ id: 'sub_racing', customer: 'cus_site', status: 'active' })
    expect((await POST(request())).status).toBe(409)
    expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it('allows checkout after a verified historical completed subscription ended', async () => {
    sdk.checkout.sessions.list.mockResolvedValue({ has_more: false, data: [{ id: 'cs_paid', mode: 'subscription', status: 'complete',
      customer: 'cus_site', subscription: 'sub_ended', metadata: { site_id: siteId, type: 'subscription' } }] })
    sdk.subscriptions.retrieve.mockResolvedValue({ id: 'sub_ended', customer: 'cus_site', status: 'canceled' })
    expect((await POST(request())).status).toBe(200)
    expect(sdk.checkout.sessions.create).toHaveBeenCalledTimes(1)
  })
  it('rechecks subscription state after confirmed expiration', async () => {
    const pending = { id: 'cs_old', mode: 'subscription', status: 'open', customer: 'cus_site', metadata: { site_id: siteId, type: 'subscription' } }
    sdk.checkout.sessions.list.mockImplementation(async () => ({ has_more: false, data: [pending] }))
    sdk.checkout.sessions.retrieve.mockImplementation(async () => ({ ...pending }))
    sdk.checkout.sessions.expire.mockImplementation(async () => { pending.status = 'expired'; return { ...pending } })
    sdk.subscriptions.list.mockResolvedValueOnce({ has_more: false, data: [] })
      .mockResolvedValueOnce({ has_more: false, data: [{ status: 'incomplete' }] })
    expect((await POST(request())).status).toBe(409)
    expect(sdk.checkout.sessions.create).not.toHaveBeenCalled()
  })
  it.each([{ discounts: ['coupon_wrong_object'] }, { discounts: [{ coupon: { id: 'coupon_existing' } }] },
    { items: { has_more: false, data: [{ id: 'si_base', price: { id: 'price_0' }, quantity: 1, discounts: ['coupon_wrong_item'] }] } }])
  ('never removes or reapplies an existing unresolved/item/coupon discount %#', async (overrides) => {
    existing(overrides)
    const response = await POST(request({ billingInterval: 'year' }))
    expect(response.status).toBe(409)
    expect((await response.json()).error).toMatch(/discounts.*preserve/)
    expect(sdk.billingPortal.sessions.create).not.toHaveBeenCalled()
    expect(sdk.checkout.sessions.create).not.toHaveBeenCalled(); expect(sdk.subscriptions.update).not.toHaveBeenCalled()
  })
  it('preserves inherited customer discount during a verified interval change without reapplying it', async () => {
    existing({ collection_method: 'charge_automatically', latest_invoice: 'in_previous',
      items: { has_more: false, data: [{ id: 'si_base', price: price('price_0'), quantity: 1,
        current_period_end: Math.floor(Date.now() / 1000) + 86400 }] } })
    sdk.customers.retrieve.mockResolvedValue({ id: 'cus_site', metadata: { site_id: siteId }, discount: { id: 'di_customer' } })
    sdk.subscriptions.update.mockResolvedValue({ id: 'sub_existing', customer: 'cus_site', latest_invoice: { status: 'paid' } })
    expect((await POST(request({ billingInterval: 'year' }))).status).toBe(200)
    expect(sdk.subscriptions.update.mock.calls[0][1]).not.toHaveProperty('discounts')
    expect(sdk.billingPortal.sessions.create).not.toHaveBeenCalled()
  })
  it('serializes simultaneous replacements with the existing durable lease', async () => {
    let held = false
    let finishExpiration!: () => void
    let expirationStarted!: () => void
    const started = new Promise<void>(resolve => { expirationStarted = resolve })
    const wait = new Promise<void>(resolve => { finishExpiration = resolve })
    leaseRpc.mockImplementation(async name => {
      if (name === 'claim_site_subscription_checkout') {
        if (held) return { data: { state: 'busy' }, error: null }
        held = true; return { data: { state: 'claimed', token: randomUUID() }, error: null }
      }
      held = false; return { data: true, error: null }
    })
    const pending = { id: 'cs_old', mode: 'subscription', status: 'open', customer: 'cus_site', metadata: { site_id: siteId, type: 'subscription' } }
    sdk.checkout.sessions.list.mockImplementation(async () => ({ has_more: false, data: [pending] }))
    sdk.checkout.sessions.retrieve.mockImplementation(async () => ({ ...pending }))
    sdk.checkout.sessions.expire.mockImplementation(async () => {
      expirationStarted(); await wait; pending.status = 'expired'; return { ...pending }
    })
    const first = POST(request({ billingInterval: 'year' }))
    await started
    expect((await POST(request({ plan: 'foundry' }))).status).toBe(503)
    finishExpiration()
    expect((await first).status).toBe(200)
    expect(sdk.checkout.sessions.expire).toHaveBeenCalledTimes(1)
    expect(sdk.checkout.sessions.create).toHaveBeenCalledTimes(1)
  })
})