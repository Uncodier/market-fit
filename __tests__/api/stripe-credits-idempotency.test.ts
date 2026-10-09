/** @jest-environment node */
import { createHash } from 'node:crypto'
import type Stripe from 'stripe'
import { CREDITS_IDEMPOTENCY_VERSION, createCreditsIdempotencyKey } from '@/app/api/stripe/checkout/credits/idempotency'

function params(): Stripe.Checkout.SessionCreateParams {
  return {
    customer: 'cus_owned', mode: 'payment', allow_promotion_codes: true,
    success_url: 'https://checkout.example.test/success', cancel_url: 'https://checkout.example.test/cancel',
    payment_method_types: ['card'],
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: 2000, product: 'prod_fixed' } }],
    metadata: { site_id: 'site_owned', credits: '20', type: 'credits_purchase', product_id: 'prod_fixed' },
    payment_intent_data: { metadata: { site_id: 'site_owned', credits: '20', type: 'credits_purchase', product_id: 'prod_fixed' } },
  }
}

const scope = { userId: 'user_authorized', siteId: 'site_owned', requestWindow: 100 }

it('is stable across equivalent retries and object property order', () => {
  const first = params()
  const reordered = Object.fromEntries(Object.entries(params()).reverse())
  reordered.metadata = { product_id: 'prod_fixed', type: 'credits_purchase', credits: '20', site_id: 'site_owned' }
  const key = createCreditsIdempotencyKey('checkout', first, scope)
  expect(createCreditsIdempotencyKey('checkout', params(), scope)).toBe(key)
  expect(createCreditsIdempotencyKey('checkout', reordered, { ...scope })).toBe(key)
  expect(key.length).toBeLessThanOrEqual(255)
  expect(key).not.toContain('user_authorized')
})

it('versions the prefix and hash and cannot collide with legacy checkout keys', () => {
  const key = createCreditsIdempotencyKey('checkout', params(), scope)
  const nextVersion = createCreditsIdempotencyKey('checkout', params(), scope, 'v3')
  const legacy = createHash('sha256').update(`${scope.userId}:${scope.siteId}:20:${scope.requestWindow}`).digest('hex')
  expect(CREDITS_IDEMPOTENCY_VERSION).toBe('v2')
  expect(key).toMatch(/^credits-checkout-v2-[a-f0-9]{64}$/)
  expect(key).not.toBe(legacy)
  expect(nextVersion).toMatch(/^credits-checkout-v3-[a-f0-9]{64}$/)
  expect(key.split('-').at(-1)).not.toBe(nextVersion.split('-').at(-1))
})

it.each<[string, (payload: Stripe.Checkout.SessionCreateParams) => void]>([
  ['success URL', payload => { payload.success_url = 'https://checkout.example.test/other-success' }],
  ['cancel URL', payload => { payload.cancel_url = 'https://checkout.example.test/other-cancel' }],
  ['customer', payload => { payload.customer = 'cus_other_owned' }],
  ['promotion flag', payload => { payload.allow_promotion_codes = false }],
  ['product', payload => { payload.line_items![0].price_data!.product = 'prod_other' }],
  ['server-owned amount', payload => { payload.line_items![0].price_data!.unit_amount = 4925 }],
  ['currency', payload => { payload.line_items![0].price_data!.currency = 'eur' }],
  ['quantity', payload => { payload.line_items![0].quantity = 2 }],
  ['mode', payload => { payload.mode = 'subscription' }],
  ['payment method', payload => { payload.payment_method_types = ['link'] }],
  ['session metadata', payload => { payload.metadata = { ...payload.metadata, credits: '52' } }],
  ['payment intent metadata', payload => { payload.payment_intent_data = { metadata: { site_id: 'other' } } }],
])('changes the key when %s changes', (_name, change) => {
  const changed = params()
  change(changed)
  expect(createCreditsIdempotencyKey('checkout', changed, scope))
    .not.toBe(createCreditsIdempotencyKey('checkout', params(), scope))
})

it.each([{ userId: 'user_other' }, { siteId: 'site_other' }, { requestWindow: 101 }])(
  'retains actor/tenant/window scoping %#', changedScope => {
    expect(createCreditsIdempotencyKey('checkout', params(), { ...scope, ...changedScope }))
      .not.toBe(createCreditsIdempotencyKey('checkout', params(), scope))
  })

it('separates provider operations and includes varying customer parameters', () => {
  const customer = { email: 'first@example.test', metadata: { site_id: 'site_owned' } }
  expect(createCreditsIdempotencyKey('customer', customer))
    .not.toBe(createCreditsIdempotencyKey('customer', { ...customer, email: 'second@example.test' }))
  expect(createCreditsIdempotencyKey('customer', customer))
    .not.toBe(createCreditsIdempotencyKey('product', customer))
})