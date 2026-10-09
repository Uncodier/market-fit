/** @jest-environment node */
import type Stripe from 'stripe'
import { applySubscriptionPromotion } from '@/app/api/stripe/subscription/promotion/discounts'

const customer = { id: 'cus_test', metadata: { site_id: 'site_test' }, discount: null } as unknown as Stripe.Customer
const coupon = { id: 'coupon_test', valid: true, amount_off: null } as Stripe.Coupon
const promo = { id: 'promo_test', code: 'SAVE20', active: true, customer: null, coupon,
  expires_at: null, max_redemptions: null, times_redeemed: 0,
  restrictions: { first_time_transaction: false, minimum_amount: null } } as Stripe.PromotionCode
const redeemed = { id: 'di_previous', customer: customer.id, subscription: 'sub_test', subscription_item: null,
  coupon: { id: 'coupon_previous' }, end: null, start: 100, promotion_code: null } as Stripe.Discount

function harness(discounts: Array<string | Stripe.Discount> = []) {
  const sub = { id: 'sub_test', customer: customer.id, currency: 'usd', discounts,
    items: { data: [{ price: { product: 'prod_base' } }, { price: { product: 'prod_addon' } }] } } as Stripe.Subscription
  const sdk = { promotionCodes: { list: jest.fn(async () => ({ data: [promo], has_more: false })) },
    subscriptions: { update: jest.fn<Promise<Stripe.Subscription>, [string, Stripe.SubscriptionUpdateParams, Stripe.RequestOptions?]>().mockResolvedValue(sub), retrieve: jest.fn(async () => ({ ...sub,
      discounts: [...discounts, { ...redeemed, id: 'di_new', coupon, promotion_code: promo.id }] })) } }
  const beforeProviderWrite = jest.fn()
  const input = { stripe: sdk as unknown as Stripe, sub, customer, code: 'SAVE20', beforeProviderWrite }
  return { input, sdk, sub, beforeProviderWrite }
}

it('preserves redeemed discount identities instead of replaying the old coupon', async () => {
  const h = harness([redeemed])
  await expect(applySubscriptionPromotion(h.input)).resolves.toEqual({ success: true, alreadyApplied: false })
  expect(h.sdk.subscriptions.update).toHaveBeenCalledWith('sub_test', {
    discounts: [{ discount: 'di_previous' }, { promotion_code: 'promo_test' }], proration_behavior: 'none',
  }, { idempotencyKey: expect.stringMatching(/^subscription-promotion-v1-/) })
})
it('retains an inherited customer discount when adding a subscription discount', async () => {
  const h = harness()
  const inherited = { ...redeemed, subscription: null }
  h.input.customer = { ...customer, discount: inherited }
  h.sdk.subscriptions.retrieve.mockResolvedValueOnce({ ...h.sub, discounts: [inherited,
    { ...redeemed, id: 'di_new', coupon, promotion_code: promo.id }] })
  await applySubscriptionPromotion(h.input)
  expect(h.sdk.subscriptions.update.mock.calls[0][1]).toMatchObject({ discounts: [
    { discount: 'di_previous' }, { promotion_code: 'promo_test' }] })
})
it('accepts a code restricted to the add-on product', async () => {
  const h = harness()
  h.sdk.promotionCodes.list.mockResolvedValueOnce({ data: [{ ...promo, coupon: { ...coupon,
    applies_to: { products: ['prod_addon'] } } }], has_more: false })
  await applySubscriptionPromotion(h.input)
  expect(h.beforeProviderWrite).toHaveBeenCalledTimes(1)
})
it('recognizes an inactive one-use code already redeemed without applying it again', async () => {
  const h = harness([{ ...redeemed, coupon, promotion_code: promo.id }])
  h.sdk.promotionCodes.list.mockResolvedValueOnce({ data: [{ ...promo, active: false }], has_more: false })
  await expect(applySubscriptionPromotion(h.input)).resolves.toEqual({ success: true, alreadyApplied: true })
  expect(h.beforeProviderWrite).not.toHaveBeenCalled()
  expect(h.sdk.subscriptions.update).not.toHaveBeenCalled()
})
it.each([
  { active: false }, { customer: 'cus_other' }, { expires_at: 1 }, { max_redemptions: 1, times_redeemed: 1 },
  { coupon: { ...coupon, valid: false } }, { coupon: { ...coupon, applies_to: { products: ['prod_foreign'] } } },
  { coupon: { ...coupon, amount_off: 500, currency: 'eur' } },
  { restrictions: { ...promo.restrictions, first_time_transaction: true } },
  { restrictions: { ...promo.restrictions, minimum_amount: 1000 } },
])('rejects ineligible promotion %# before any Stripe write', async override => {
  const h = harness()
  h.sdk.promotionCodes.list.mockResolvedValueOnce({ data: [{ ...promo, ...override }], has_more: false })
  await expect(applySubscriptionPromotion(h.input)).rejects.toThrow()
  expect(h.beforeProviderWrite).not.toHaveBeenCalled()
  expect(h.sdk.subscriptions.update).not.toHaveBeenCalled()
})
it('fails closed when a redeemed discount cannot be expanded', async () => {
  const h = harness(['di_previous'])
  await expect(applySubscriptionPromotion(h.input)).rejects.toMatchObject({ status: 409 })
  expect(h.sdk.subscriptions.update).not.toHaveBeenCalled()
})
it('does not claim success when Stripe omits an existing discount on confirmation', async () => {
  const h = harness([redeemed])
  h.sdk.subscriptions.retrieve.mockResolvedValueOnce({ ...h.sub, discounts: [
    { ...redeemed, id: 'di_new', coupon, promotion_code: promo.id }] })
  await expect(applySubscriptionPromotion(h.input)).rejects.toMatchObject({ status: 409 })
})

it.each([{ redeem_by: 1 }, { max_redemptions: 1, times_redeemed: 1 }])(
  'rejects an exhausted or expired parent coupon %#', async override => {
    const h = harness()
    h.sdk.promotionCodes.list.mockResolvedValueOnce({ data: [{ ...promo, coupon: { ...coupon, ...override } }], has_more: false })
    await expect(applySubscriptionPromotion(h.input)).rejects.toThrow('Invalid or inactive')
    expect(h.sdk.subscriptions.update).not.toHaveBeenCalled()
  })

it.each([{ start: 200 }, { end: 9999999999 }])(
  'rejects confirmation that resets existing discount duration %#', async override => {
    const h = harness([redeemed])
    h.sdk.subscriptions.retrieve.mockResolvedValueOnce({ ...h.sub, discounts: [
      { ...redeemed, ...override }, { ...redeemed, id: 'di_new', coupon, promotion_code: promo.id }] })
    await expect(applySubscriptionPromotion(h.input)).rejects.toMatchObject({ status: 409 })
  })