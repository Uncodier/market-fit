/** @jest-environment node */
import { randomBytes, randomUUID } from 'node:crypto'
import Stripe from 'stripe'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { POST } from '@/app/api/stripe/portal/route'

jest.mock('stripe', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/redis/control-plane', () => ({
  checkRateLimit: jest.fn(async () => ({ allowed: true })),
  hashRedisKeyPart: jest.fn(async (part) => part),
}))

const siteId = randomUUID()
const origin = 'https://portal.example.test'
const from = jest.fn()
const rpc = jest.fn()
const auth = { getUser: jest.fn() }
const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn() }
const sdk = {
  customers: { retrieve: jest.fn(), update: jest.fn() },
  subscriptions: { update: jest.fn() },
  billingPortal: {
    configurations: { retrieve: jest.fn(), list: jest.fn(), create: jest.fn(), update: jest.fn() },
    sessions: { create: jest.fn() },
  },
}
function configuration() {
  return { id: 'bpc_generic', active: true, is_default: true, features: {
    subscription_update: { enabled: false },
    subscription_cancel: { enabled: true, mode: 'at_period_end', proration_behavior: 'none' },
  } }
}
function request(body: unknown = {}, authenticated = true) {
  return new NextRequest(new URL('/api/stripe/portal', origin), {
    method: 'POST', headers: { origin, 'content-type': 'application/json',
      ...(authenticated ? { authorization: `Bearer ${randomBytes(24).toString('hex')}` } : {}) },
    body: JSON.stringify({ siteId, returnUrl: `${origin}/billing`, ...(body as object) }),
  })
}
function expectNoSession() {
  expect(sdk.billingPortal.sessions.create).not.toHaveBeenCalled()
}
beforeEach(() => {
  jest.clearAllMocks()
  process.env.STRIPE_SECRET_KEY = randomBytes(24).toString('hex')
  process.env.CHECKOUT_RETURN_ORIGINS = origin
  process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID = 'bpc_generic'
  process.env.STRIPE_SUBSCRIPTION_UPDATE_PORTAL_CONFIGURATION_ID = 'bpc_update'
  jest.mocked(Stripe).mockImplementation(() => sdk as unknown as Stripe)
  jest.mocked(createClient).mockResolvedValue({ auth, from, rpc } as unknown as Awaited<ReturnType<typeof createClient>>)
  auth.getUser.mockResolvedValue({ data: { user: { id: randomUUID(), email: 'owner@example.test' } }, error: null })
  rpc.mockResolvedValue({ data: 'owner', error: null })
  from.mockReturnValue(query)
  query.select.mockReturnThis(); query.eq.mockReturnThis()
  query.maybeSingle.mockResolvedValue({ data: { stripe_customer_id: 'cus_site' }, error: null })
  sdk.customers.retrieve.mockResolvedValue({ id: 'cus_site', metadata: { site_id: siteId } })
  sdk.billingPortal.configurations.retrieve.mockResolvedValue(configuration())
  sdk.billingPortal.sessions.create.mockResolvedValue({ url: 'https://billing.example.test/session' })
})
afterEach(() => {
  for (const key of ['STRIPE_SECRET_KEY', 'CHECKOUT_RETURN_ORIGINS', 'STRIPE_BILLING_PORTAL_CONFIGURATION_ID',
    'STRIPE_SUBSCRIPTION_UPDATE_PORTAL_CONFIGURATION_ID']) delete process.env[key]
  expect(sdk.billingPortal.configurations.list).not.toHaveBeenCalled()
  expect(sdk.billingPortal.configurations.create).not.toHaveBeenCalled()
  expect(sdk.billingPortal.configurations.update).not.toHaveBeenCalled()
  expect(sdk.subscriptions.update).not.toHaveBeenCalled()
  expect(sdk.customers.update).not.toHaveBeenCalled()
})

describe('generic billing portal safety', () => {
  it('authorizes the manager and binds the billing customer before explicitly selecting a safe config', async () => {
    const response = await POST(request({ customerId: 'cus_attacker', configuration: 'bpc_update' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ url: 'https://billing.example.test/session' })
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(createClient).toHaveBeenCalledWith(true)
    expect(rpc).toHaveBeenCalledWith('current_user_site_role', { p_site_id: siteId })
    expect(query.eq).toHaveBeenCalledWith('site_id', siteId)
    expect(sdk.customers.retrieve).toHaveBeenCalledWith('cus_site')
    expect(sdk.billingPortal.configurations.retrieve).toHaveBeenCalledWith('bpc_generic')
    expect(sdk.billingPortal.sessions.create).toHaveBeenCalledWith({ customer: 'cus_site',
      configuration: 'bpc_generic', return_url: `${origin}/billing` })
  })
  it('rejects missing authentication before database or SDK access', async () => {
    expect((await POST(request({}, false))).status).toBe(401)
    expect(createClient).not.toHaveBeenCalled(); expect(Stripe).not.toHaveBeenCalled(); expectNoSession()
  })
  it('rejects an invalid identity', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await POST(request())).status).toBe(401)
    expect(from).not.toHaveBeenCalled(); expect(Stripe).not.toHaveBeenCalled(); expectNoSession()
  })
  it.each(['collaborator', 'marketing', null])('rejects nonmanager/cross-tenant role %s', async (role) => {
    rpc.mockResolvedValue({ data: role, error: null })
    expect((await POST(request())).status).toBe(403)
    expect(from).not.toHaveBeenCalled(); expect(Stripe).not.toHaveBeenCalled(); expectNoSession()
  })
  it.each([{ siteId: 'invalid' }, { siteId: {} }, { returnUrl: 7 }, { returnUrl: '' },
    { returnUrl: 'https://untrusted.example.test/billing' }])('rejects invalid input %#', async (body) => {
    expect((await POST(request(body))).status).toBe(400)
    expect(Stripe).not.toHaveBeenCalled(); expectNoSession()
  })
  it('rejects malformed JSON', async () => {
    const req = request(); jest.spyOn(req, 'json').mockRejectedValue(new SyntaxError())
    expect((await POST(req)).status).toBe(400); expect(Stripe).not.toHaveBeenCalled(); expectNoSession()
  })
  it('rejects credential-bearing return URLs', async () => {
    const url = new URL('/billing', origin)
    url.username = randomBytes(16).toString('hex'); url.password = randomBytes(24).toString('hex')
    const response = await POST(request({ returnUrl: url.toString() }))
    expect(response.status).toBe(400)
    const serialized = JSON.stringify(await response.json())
    expect(serialized).not.toContain(url.username); expect(serialized).not.toContain(url.password)
    expect(Stripe).not.toHaveBeenCalled(); expectNoSession()
  })
  it.each([undefined, '', 'not-a-config', 'bpc_update'])('fails closed for missing/invalid/shared generic config %s', async (id) => {
    if (id === undefined) delete process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID
    else process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID = id
    expect((await POST(request())).status).toBe(409)
    expect(Stripe).not.toHaveBeenCalled(); expectNoSession()
  })
  it.each([{ id: 'cus_other', metadata: { site_id: siteId } }, { id: 'cus_site', deleted: true },
    { id: 'cus_site', metadata: { site_id: randomUUID() } }, { id: 'cus_site', metadata: {} },
    { id: 'cus_site' }])('rejects invalid customer binding %#', async (customer) => {
    sdk.customers.retrieve.mockResolvedValue(customer)
    expect((await POST(request())).status).toBe(409)
    expect(sdk.billingPortal.configurations.retrieve).not.toHaveBeenCalled(); expectNoSession()
  })
  it.each(['price', 'quantity', 'promotion_code'])('rejects any enabled subscription updates, including %s', async (update) => {
    const config = configuration()
    sdk.billingPortal.configurations.retrieve.mockResolvedValue({ ...config, features: { ...config.features,
      subscription_update: { enabled: true, default_allowed_updates: [update], proration_behavior: 'always_invoice' } } })
    expect((await POST(request())).status).toBe(409); expectNoSession()
  })
  it.each([{ active: false }, { id: 'bpc_other' }, { features: {} }, { features: undefined }])('rejects unavailable/unproven config %#', async (override) => {
    sdk.billingPortal.configurations.retrieve.mockResolvedValue({ ...configuration(), ...override })
    expect((await POST(request())).status).toBe(409); expectNoSession()
  })
  it.each([{ mode: 'immediately', proration_behavior: 'none' }, { mode: 'at_period_end', proration_behavior: 'create_prorations' }])('rejects unsupported cancellation %#', async (cancel) => {
    const config = configuration()
    config.features.subscription_cancel = { enabled: true, ...cancel }
    sdk.billingPortal.configurations.retrieve.mockResolvedValue(config)
    expect((await POST(request())).status).toBe(409); expectNoSession()
  })
  it('returns 409 for an unavailable configured portal without leaking provider errors', async () => {
    const sensitive = randomBytes(24).toString('hex')
    sdk.billingPortal.configurations.retrieve.mockRejectedValue(new Error(sensitive))
    const response = await POST(request())
    expect(response.status).toBe(409); expect(JSON.stringify(await response.json())).not.toContain(sensitive); expectNoSession()
  })
  it('does not expose provider errors or log credentials', async () => {
    const sensitive = randomBytes(24).toString('hex')
    const log = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
      sdk.billingPortal.sessions.create.mockRejectedValue(new Error(sensitive))
      const response = await POST(request())
      expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain(sensitive)
      expect(log).not.toHaveBeenCalled()
    } finally { log.mockRestore() }
  })
  it('distinguishes missing billing from billing lookup failure', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect((await POST(request())).status).toBe(404); expectNoSession()
    query.maybeSingle.mockResolvedValue({ data: null, error: { message: randomBytes(16).toString('hex') } })
    expect((await POST(request())).status).toBe(503); expectNoSession()
  })
})