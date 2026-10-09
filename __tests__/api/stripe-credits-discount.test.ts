/** @jest-environment node */
import type Stripe from 'stripe'
import { CREDIT_PACKAGES, getCreditPackage, type CreditPackage } from '@/lib/credit-packages'
import { isFullyDiscountedCreditsCheckout } from '@/app/api/stripe/webhook/credit-purchase-discount'

function freeCheckout(pkg: CreditPackage): Stripe.Checkout.Session {
  return {
    mode: 'payment', status: 'complete', payment_status: 'no_payment_required', payment_intent: null,
    currency: pkg.currency, amount_subtotal: pkg.unitAmount, amount_total: 0,
    total_details: { amount_discount: pkg.unitAmount, amount_tax: 0, amount_shipping: 0 },
    metadata: { type: 'credits_purchase', credits: String(pkg.credits) },
  } as unknown as Stripe.Checkout.Session
}

it('keeps the canonical server-owned packages in integer USD cents', () => {
  expect(CREDIT_PACKAGES).toEqual([
    { credits: 20, unitAmount: 2000, currency: 'usd' },
    { credits: 52, unitAmount: 4925, currency: 'usd' },
    { credits: 515, unitAmount: 50000, currency: 'usd' },
  ])
  expect(Object.isFrozen(CREDIT_PACKAGES)).toBe(true)
  CREDIT_PACKAGES.forEach(pkg => {
    expect(Object.isFrozen(pkg)).toBe(true)
    expect(getCreditPackage(pkg.credits)).toBe(pkg)
  })
})

it.each([null, undefined, '20', 20.1, 0, 21, {}, NaN, Infinity])('does not coerce an unknown package %#', value => {
  expect(getCreditPackage(value)).toBeUndefined()
})

it.each(CREDIT_PACKAGES)('proves the full discount for the canonical $credits-credit package', pkg => {
  expect(isFullyDiscountedCreditsCheckout(freeCheckout(pkg))).toBe(true)
})

it.each(['020', '20.0', '20 ', ' 20', '2e1', '20junk', '21', '__proto__', 'constructor', '']) (
  'rejects noncanonical credit metadata %s', credits => {
    const session = freeCheckout(CREDIT_PACKAGES[0])
    session.metadata!.credits = credits
    expect(isFullyDiscountedCreditsCheckout(session)).toBe(false)
  })

it.each([{ mode: 'subscription' }, { status: 'open' }, { payment_status: 'paid' },
  { payment_intent: 'pi_unexpected' }, { currency: 'eur' }, { amount_subtotal: 4925 },
  { amount_total: 1 }, { total_details: null },
  { total_details: { amount_discount: 1999, amount_tax: 0, amount_shipping: 0 } },
  { total_details: { amount_discount: 2000, amount_tax: 1, amount_shipping: 0 } },
  { total_details: { amount_discount: 2000, amount_tax: 0, amount_shipping: 1 } },
  { metadata: null }, { metadata: { credits: '20', type: 'sale' } }])(
  'rejects a free Checkout with incomplete or inconsistent proof %#', override => {
    expect(isFullyDiscountedCreditsCheckout({ ...freeCheckout(CREDIT_PACKAGES[0]), ...override } as Stripe.Checkout.Session)).toBe(false)
  })