/** @jest-environment node */
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { requireStripeSiteAccess } from '@/lib/auth/api-stripe-access'
import { createClient } from '@/lib/supabase/server'
import { POST } from '@/app/api/stripe/checkout/credits/route'

jest.mock('stripe', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('@/lib/auth/api-stripe-access', () => ({ requireStripeSiteAccess: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))

const origin = 'https://checkout.example.test'
const siteId = '82b223a6-89ce-46d5-af3d-8798d0ea4529'
const createSession = jest.fn()
const createCustomer = jest.fn()
const retrieveProduct = jest.fn()
const createProduct = jest.fn()
const single = jest.fn()
const rpc = jest.fn()
const envKeys = ['STRIPE_SECRET_KEY', 'CHECKOUT_RETURN_ORIGINS',
  'STRIPE_CREDITS_20_PRODUCT_ID', 'STRIPE_CREDITS_52_PRODUCT_ID', 'STRIPE_CREDITS_515_PRODUCT_ID']
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]))

function request(body: Record<string, unknown> = {}) {
  return new NextRequest(`${origin}/api/stripe/checkout/credits`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ siteId, credits: 20, amount: 20,
      successUrl: `${origin}/billing/success`, cancelUrl: `${origin}/checkout`, ...body }),
  })
}

beforeEach(() => {
  jest.resetAllMocks()
  jest.spyOn(Date, 'now').mockReturnValue(1800000000000)
  jest.spyOn(console, 'error').mockImplementation(() => {})
  envKeys.forEach(key => { delete process.env[key] })
  process.env.STRIPE_SECRET_KEY = 'sk_test_checkout'
  process.env.CHECKOUT_RETURN_ORIGINS = origin
  jest.mocked(Stripe).mockImplementation(() => ({ checkout: { sessions: { create: createSession } },
    customers: { create: createCustomer }, products: { retrieve: retrieveProduct, create: createProduct } }) as unknown as Stripe)
  jest.mocked(requireStripeSiteAccess).mockResolvedValue({ userId: 'authorized_user', userEmail: 'buyer@example.test' } as never)
  jest.mocked(createClient).mockResolvedValue({ from: () => ({ select: () => ({ eq: () => ({
    single,
  }) }) }), rpc } as never)
  single.mockResolvedValue({ data: { stripe_customer_id: 'cus_site' }, error: null })
  retrieveProduct.mockImplementation(async id => ({ id, active: true,
    metadata: { type: 'credits_purchase', credits: id.split('_').at(-1) } }))
  createProduct.mockImplementation(async params => ({ ...params, object: 'product' }))
  createCustomer.mockResolvedValue({ id: 'cus_new' })
  rpc.mockResolvedValue({ error: null })
  createSession.mockResolvedValue({ id: 'cs_credits', url: 'https://checkout.stripe.test/pay' })
})
afterEach(() => jest.restoreAllMocks())
afterAll(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

function expectNoProviderWork() {
  expect(Stripe).not.toHaveBeenCalled()
  expect(retrieveProduct).not.toHaveBeenCalled()
  expect(createProduct).not.toHaveBeenCalled()
  expect(createCustomer).not.toHaveBeenCalled()
  expect(createSession).not.toHaveBeenCalled()
  expect(createClient).not.toHaveBeenCalled()
  expect(rpc).not.toHaveBeenCalled()
}

it('imports without initializing the SDK or requiring Stripe credentials', async () => {
  delete process.env.STRIPE_SECRET_KEY
  await jest.isolateModulesAsync(async () => {
    await import('@/app/api/stripe/checkout/credits/route')
    const sdk = (await import('stripe')).default
    expect(sdk).not.toHaveBeenCalled()
  })
  expectNoProviderWork()
})

it.each([[20, 20], [52, 49.25], [515, 500]])(
  'enables customer-entered codes on the trusted %s-credit package', async (credits, amount) => {
    const response = await POST(request({ credits, amount }))
    expect(response.status).toBe(200)
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'payment', allow_promotion_codes: true, customer: 'cus_site',
      line_items: [{ quantity: 1, price_data: {
        currency: 'usd', product: `prod_makinari_credits_${credits}`, unit_amount: Math.round(amount * 100),
      } }],
      metadata: { site_id: siteId, credits: String(credits), type: 'credits_purchase',
        product_id: `prod_makinari_credits_${credits}` },
    }), expect.objectContaining({ idempotencyKey: expect.any(String) }))
    expect(retrieveProduct).toHaveBeenCalledWith(`prod_makinari_credits_${credits}`)
    expect(createProduct).not.toHaveBeenCalled()
    expect(requireStripeSiteAccess).toHaveBeenCalledWith(expect.any(NextRequest), siteId)
  })

it('does not create a Checkout Session for an untrusted package amount', async () => {
  expect((await POST(request({ amount: 1 }))).status).toBe(400)
  expectNoProviderWork()
})

it.each([401, 403, 429])('does not create a Product/customer/session without authorized site access (%s)', async status => {
  jest.mocked(requireStripeSiteAccess).mockResolvedValueOnce({
    error: NextResponse.json({ error: 'Access denied' }, { status }),
  } as never)
  expect((await POST(request())).status).toBe(status)
  expectNoProviderWork()
})

it.each([{ credits: '20' }, { credits: 20.1 }, { credits: 0 }, { credits: 21 },
  { credits: null }, { amount: '20' }, { amount: -20 }, { amount: 20.001 },
  { siteId: null }, { siteId: 'another-site' }, { siteId: 20 },
  { cancelUrl: false }, { cancelUrl: '' }, { successUrl: false }, { successUrl: null },
  { successUrl: 'https://foreign.example.test/pay' }, { cancelUrl: 'https://foreign.example.test/pay' },
  { successUrl: 'https://user:password@checkout.example.test/pay' }])(
  'rejects malformed or untrusted checkout input %# before provider work', async body => {
    expect((await POST(request(body))).status).toBe(400)
    expectNoProviderWork()
  })

it.each(['{', 'null', '[]', '"text"', '42'])('rejects invalid JSON/body %s', async body => {
  const response = await POST(new NextRequest(`${origin}/api/stripe/checkout/credits`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body,
  }))
  expect(response.status).toBe(400)
  expect(requireStripeSiteAccess).not.toHaveBeenCalled()
  expectNoProviderWork()
})

it.each([undefined, 'not_a_secret'])('fails closed on invalid Stripe configuration %s at request time', async secret => {
  if (secret === undefined) delete process.env.STRIPE_SECRET_KEY
  else process.env.STRIPE_SECRET_KEY = secret
  expect((await POST(request())).status).toBe(500)
  expectNoProviderWork()
})

it('uses a configured Product and ignores forged customer/product/promotion/price inputs', async () => {
  process.env.STRIPE_CREDITS_20_PRODUCT_ID = 'prod_existing'
  expect((await POST(request({ product: 'prod_forged', customer: 'cus_foreign',
    unit_amount: 1, currency: 'eur', allow_promotion_codes: false }))).status).toBe(200)
  expect(retrieveProduct).toHaveBeenCalledWith('prod_existing')
  expect(createSession.mock.calls[0][0]).toMatchObject({ customer: 'cus_site', allow_promotion_codes: true,
    line_items: [{ price_data: { product: 'prod_existing', currency: 'usd', unit_amount: 2000 } }] })
})

it('creates only the deterministic Product when an authorized checkout finds it missing', async () => {
  retrieveProduct.mockRejectedValueOnce({ type: 'StripeInvalidRequestError', code: 'resource_missing', statusCode: 404 })
  expect((await POST(request())).status).toBe(200)
  expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({
    id: 'prod_makinari_credits_20', active: true,
  }), expect.objectContaining({ idempotencyKey: expect.stringMatching(/^credits-product-v2-/) }))
  expect(jest.mocked(requireStripeSiteAccess).mock.invocationCallOrder[0]).toBeLessThan(createProduct.mock.invocationCallOrder[0])
})

it.each([{ id: 'prod_makinari_credits_20', active: false },
  { id: 'prod_makinari_credits_20', deleted: true }])('never revives an unavailable Product %#', async product => {
  retrieveProduct.mockResolvedValueOnce(product)
  const response = await POST(request())
  expect(response.status).toBe(500)
  expect(await response.json()).toEqual({ error: 'Failed to create checkout session' })
  expect(createProduct).not.toHaveBeenCalled()
  expect(createClient).not.toHaveBeenCalled()
  expect(createSession).not.toHaveBeenCalled()
})

it('reuses the Product and exact idempotency key for retries in the request window', async () => {
  const first = await POST(request())
  const retry = await POST(request())
  expect(await first.json()).toEqual(await retry.json())
  expect(createSession.mock.calls[0]).toEqual(createSession.mock.calls[1])
  expect(createSession.mock.calls[0][1].idempotencyKey).toMatch(/^credits-checkout-v2-/)
  expect(createProduct).not.toHaveBeenCalled()
})

it('shares one idempotency key across concurrent identical checkout requests', async () => {
  const responses = await Promise.all([POST(request()), POST(request())])
  expect(responses.map(response => response.status)).toEqual([200, 200])
  expect(createSession.mock.calls[0]).toEqual(createSession.mock.calls[1])
  expect(createProduct).not.toHaveBeenCalled()
})

it.each(['successUrl', 'cancelUrl'])('changes the key when the trusted %s changes', async field => {
  await POST(request())
  await POST(request({ [field]: `${origin}/other-return-path` }))
  expect(createSession.mock.calls[0][1]).not.toEqual(createSession.mock.calls[1][1])
})

it('changes the key when the configured Product or stored customer changes', async () => {
  await POST(request())
  process.env.STRIPE_CREDITS_20_PRODUCT_ID = 'prod_reconfigured'
  await POST(request())
  single.mockResolvedValueOnce({ data: { stripe_customer_id: 'cus_changed' }, error: null })
  await POST(request())
  const keys = createSession.mock.calls.map(([, options]) => options.idempotencyKey)
  expect(new Set(keys).size).toBe(3)
})

it('preserves the key when retrying after an ambiguous Session failure', async () => {
  createSession.mockRejectedValueOnce(new Error('private Stripe details'))
  const response = await POST(request())
  expect(response.status).toBe(500)
  expect(await response.json()).toEqual({ error: 'Failed to create checkout session' })
  expect((await POST(request())).status).toBe(200)
  expect(createSession.mock.calls[0]).toEqual(createSession.mock.calls[1])
})

it('keeps customer creation idempotent without resetting credits or the plan', async () => {
  single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
  await POST(request())
  await POST(request())
  expect(createCustomer.mock.calls[0]).toEqual(createCustomer.mock.calls[1])
  expect(createCustomer.mock.calls[0][1].idempotencyKey).toMatch(/^credits-customer-v2-/)
  expect(rpc).toHaveBeenCalledWith('upsert_billing', {
    p_site_id: siteId, p_stripe_customer_id: 'cus_new', p_auto_renew: true,
  })
  expect(createSession.mock.calls[0]).toEqual(createSession.mock.calls[1])
})