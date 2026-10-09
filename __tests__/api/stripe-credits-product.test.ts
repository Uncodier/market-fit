/** @jest-environment node */
import type Stripe from 'stripe'
import { CREDIT_PACKAGES } from '@/lib/credit-packages'
import { resolveCreditsProduct } from '@/app/api/stripe/checkout/credits/product'

const envKeys = CREDIT_PACKAGES.map(pkg => `STRIPE_CREDITS_${pkg.credits}_PRODUCT_ID`)
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]))
const missing = { type: 'StripeInvalidRequestError', code: 'resource_missing', statusCode: 404 }
const duplicate = { type: 'StripeInvalidRequestError', code: 'resource_already_exists', statusCode: 400 }

function harness() {
  const retrieve = jest.fn(async (id: string) => ({ id, active: true,
    metadata: { type: 'credits_purchase', credits: id.split('_').at(-1) } }))
  const create = jest.fn(async (params: Stripe.ProductCreateParams) => ({ ...params, object: 'product' }))
  const stripe = { products: { retrieve, create } } as unknown as Pick<Stripe, 'products'>
  return { stripe, retrieve, create }
}

beforeEach(() => envKeys.forEach(key => { delete process.env[key] }))
afterAll(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

it.each(CREDIT_PACKAGES)('reuses the active $credits-credit Product on every call', async pkg => {
  const h = harness()
  const id = `prod_makinari_credits_${pkg.credits}`
  await expect(resolveCreditsProduct(h.stripe, pkg)).resolves.toBe(id)
  await expect(resolveCreditsProduct(h.stripe, pkg)).resolves.toBe(id)
  expect(h.retrieve).toHaveBeenNthCalledWith(1, id)
  expect(h.retrieve).toHaveBeenNthCalledWith(2, id)
  expect(h.create).not.toHaveBeenCalled()
})

it.each(CREDIT_PACKAGES)('retrieves the server-configured $credits-credit Product without requiring app metadata', async pkg => {
  const h = harness()
  process.env[`STRIPE_CREDITS_${pkg.credits}_PRODUCT_ID`] = 'prod_operator_managed'
  h.retrieve.mockResolvedValueOnce({ id: 'prod_operator_managed', active: true } as never)
  await expect(resolveCreditsProduct(h.stripe, pkg)).resolves.toBe('prod_operator_managed')
  expect(h.retrieve).toHaveBeenCalledWith('prod_operator_managed')
  expect(h.create).not.toHaveBeenCalled()
})

it.each(CREDIT_PACKAGES)('creates only a missing deterministic $credits-credit Product with a stable key', async pkg => {
  const h = harness()
  h.retrieve.mockRejectedValue(missing)
  const id = `prod_makinari_credits_${pkg.credits}`
  await expect(resolveCreditsProduct(h.stripe, pkg)).resolves.toBe(id)
  await expect(resolveCreditsProduct(h.stripe, pkg)).resolves.toBe(id)
  expect(h.create).toHaveBeenCalledWith({ id, active: true,
    name: `${pkg.credits} Credits Package`, description: `Purchase ${pkg.credits} credits for your Uncodie account`,
    metadata: { type: 'credits_purchase', credits: String(pkg.credits) },
  }, { idempotencyKey: expect.stringMatching(/^credits-product-v2-/) })
  expect(h.create.mock.calls[0]).toEqual(h.create.mock.calls[1])
})

it('never provisions a replacement for a missing configured Product', async () => {
  const h = harness()
  process.env.STRIPE_CREDITS_20_PRODUCT_ID = 'prod_configured_missing'
  h.retrieve.mockRejectedValue(missing)
  await expect(resolveCreditsProduct(h.stripe, CREDIT_PACKAGES[0])).rejects.toEqual(missing)
  expect(h.retrieve).toHaveBeenCalledTimes(1)
  expect(h.create).not.toHaveBeenCalled()
})

it.each(['', ' prod_spaces', 'prod/invalid', 'x'.repeat(256)])('rejects malformed server Product configuration %s', async id => {
  const h = harness()
  process.env.STRIPE_CREDITS_20_PRODUCT_ID = id
  await expect(resolveCreditsProduct(h.stripe, CREDIT_PACKAGES[0])).rejects.toThrow('configuration')
  expect(h.retrieve).not.toHaveBeenCalled()
  expect(h.create).not.toHaveBeenCalled()
})

it.each([new Error('network failure'), { type: 'StripeAPIError', statusCode: 500 },
  { type: 'StripeAuthenticationError', statusCode: 401 }, { statusCode: 404 },
  { ...missing, statusCode: 403 }, { ...missing, type: 'StripePermissionError' }])(
  'does not treat a provider failure as a missing Product %#', async error => {
    const h = harness()
    h.retrieve.mockRejectedValueOnce(error)
    await expect(resolveCreditsProduct(h.stripe, CREDIT_PACKAGES[0])).rejects.toEqual(error)
    expect(h.create).not.toHaveBeenCalled()
  })

it.each([{ active: false }, { deleted: true }, { active: undefined },
  { id: 'prod_other' }, { metadata: {} }, { metadata: { type: 'sale', credits: '20' } },
  { metadata: { type: 'credits_purchase', credits: '52' } }])(
  'fails closed on unavailable or mismatched Products %#', async override => {
    const h = harness()
    h.retrieve.mockResolvedValueOnce({ id: 'prod_makinari_credits_20', active: true,
      metadata: { type: 'credits_purchase', credits: '20' }, ...override } as never)
    await expect(resolveCreditsProduct(h.stripe, CREDIT_PACKAGES[0])).rejects.toThrow()
    expect(h.create).not.toHaveBeenCalled()
  })

it('checks availability again rather than caching an active Product across requests', async () => {
  const h = harness()
  await resolveCreditsProduct(h.stripe, CREDIT_PACKAGES[0])
  h.retrieve.mockResolvedValueOnce({ id: 'prod_makinari_credits_20', active: false } as never)
  await expect(resolveCreditsProduct(h.stripe, CREDIT_PACKAGES[0])).rejects.toThrow('unavailable')
  expect(h.create).not.toHaveBeenCalled()
})

it('recovers a creation race by retrieving the same Product, never by generating another ID', async () => {
  const h = harness()
  h.retrieve.mockRejectedValueOnce(missing)
  h.create.mockRejectedValueOnce(duplicate)
  await expect(resolveCreditsProduct(h.stripe, CREDIT_PACKAGES[0])).resolves.toBe('prod_makinari_credits_20')
  expect(h.retrieve).toHaveBeenCalledTimes(2)
  expect(h.create).toHaveBeenCalledTimes(1)
})

it('does not accept an archived winner of a Product creation race', async () => {
  const h = harness()
  h.retrieve.mockRejectedValueOnce(missing)
    .mockResolvedValueOnce({ id: 'prod_makinari_credits_20', active: false } as never)
  h.create.mockRejectedValueOnce(duplicate)
  await expect(resolveCreditsProduct(h.stripe, CREDIT_PACKAGES[0])).rejects.toThrow('unavailable')
})

it('propagates an ambiguous creation failure and retries exactly the same parameters', async () => {
  const h = harness()
  h.retrieve.mockRejectedValue(missing)
  h.create.mockRejectedValueOnce(new Error('network failure'))
  await expect(resolveCreditsProduct(h.stripe, CREDIT_PACKAGES[0])).rejects.toThrow('network failure')
  await expect(resolveCreditsProduct(h.stripe, CREDIT_PACKAGES[0])).resolves.toBe('prod_makinari_credits_20')
  expect(h.create.mock.calls[0]).toEqual(h.create.mock.calls[1])
})