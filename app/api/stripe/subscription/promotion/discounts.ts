import type Stripe from 'stripe'
import { createHash } from 'node:crypto'
import { stripeObjectId } from '@/app/api/stripe/webhook/subscription-billing'
import { SubscriptionRequestError } from '@/lib/subscription-pricing.server'

export const promotionReview = () => new SubscriptionRequestError('Subscription discounts require billing support to preserve their terms', 409)

export function retainedDiscounts(sub: Stripe.Subscription, customer: Stripe.Customer): Stripe.Discount[] {
  const now = Math.floor(Date.now() / 1000)
  const raw = sub.discounts?.length ? sub.discounts : customer.discount ? [customer.discount] : []
  const retained = raw.map(value => {
    if (typeof value === 'string' || !value.id || value.deleted || !value.coupon?.id ||
        (stripeObjectId(value.customer) !== customer.id) ||
        (value.subscription && value.subscription !== sub.id) || value.subscription_item ||
        (value.end !== null && value.end !== undefined && value.end <= now)) throw promotionReview()
    return value
  })
  if (new Set(retained.map(value => value.id)).size !== retained.length) throw promotionReview()
  return retained
}

export async function applySubscriptionPromotion(params: {
  stripe: Stripe; sub: Stripe.Subscription; customer: Stripe.Customer; code: string
  beforeProviderWrite: () => void
}) {
  const { stripe, sub, customer, code } = params
  const retained = retainedDiscounts(sub, customer)
  const listed = await stripe.promotionCodes.list({ code, limit: 100 })
  if (listed.has_more) throw promotionReview()
  const candidates = listed.data.filter(promo => promo.code.toLowerCase() === code.toLowerCase() &&
    (!promo.customer || stripeObjectId(promo.customer) === customer.id))
  // Recognize a completed retry even if a one-use code is now inactive.
  const previous = retained.find(discount => candidates.some(promo => promo.id === stripeObjectId(discount.promotion_code)))
  if (previous) return { success: true, alreadyApplied: true }
  const active = candidates.filter(promo => promo.active)
  const customerCodes = active.filter(promo => stripeObjectId(promo.customer) === customer.id)
  const matches = customerCodes.length ? customerCodes : active.filter(promo => !promo.customer)
  if (matches.length !== 1) throw new SubscriptionRequestError('Invalid or inactive promotion code')
  const promo = matches[0]
  const coupon = promo.coupon
  const now = Math.floor(Date.now() / 1000)
  if (!coupon.valid || (promo.expires_at != null && promo.expires_at <= now) ||
      (promo.max_redemptions != null && promo.times_redeemed >= promo.max_redemptions) ||
      (coupon.redeem_by != null && coupon.redeem_by <= now) ||
      (coupon.max_redemptions != null && coupon.times_redeemed >= coupon.max_redemptions)) {
    throw new SubscriptionRequestError('Invalid or inactive promotion code')
  }
  // Stripe's pinned API does not allow minimum-amount codes on subscription updates.
  if (promo.restrictions.first_time_transaction || promo.restrictions.minimum_amount != null ||
      Object.values(promo.restrictions.currency_options ?? {}).some(value => value.minimum_amount > 0)) {
    throw new SubscriptionRequestError('This promotion is only available during eligible Checkout purchases')
  }
  if (coupon.amount_off !== null && coupon.currency !== sub.currency && !coupon.currency_options?.[sub.currency]) {
    throw new SubscriptionRequestError('Promotion currency does not match this subscription')
  }
  if (coupon.applies_to?.products?.length && !sub.items.data.some(item =>
    coupon.applies_to!.products.includes(stripeObjectId(item.price.product) ?? ''))) {
    throw new SubscriptionRequestError('Promotion does not apply to this subscription or its add-ons')
  }
  if (retained.length >= 20 || retained.some(discount => discount.coupon.id === coupon.id)) {
    throw new SubscriptionRequestError('This discount is already applied or cannot be combined with existing discounts')
  }
  // Reuse redeemed IDs, never replay coupons (which would reset their duration).
  const discounts = [...retained.map(discount => ({ discount: discount.id })), { promotion_code: promo.id }]
  const generation = createHash('sha256').update(JSON.stringify({ subscription: sub.id,
    promotion: promo.id, discounts: retained.map(discount => discount.id) })).digest('hex')
  params.beforeProviderWrite()
  await stripe.subscriptions.update(sub.id, { discounts, proration_behavior: 'none' }, {
    idempotencyKey: `subscription-promotion-v1-${generation}`,
  })
  const confirmed = await stripe.subscriptions.retrieve(sub.id, { expand: ['discounts'] })
  if (confirmed.id !== sub.id || stripeObjectId(confirmed.customer) !== customer.id) throw promotionReview()
  const current = retainedDiscounts(confirmed, customer)
  if (current.length !== retained.length + 1 || !retained.every((discount, index) =>
    current[index].id === discount.id && current[index].start === discount.start &&
    current[index].end === discount.end) ||
    stripeObjectId(current[current.length - 1].promotion_code) !== promo.id) throw promotionReview()
  return { success: true, alreadyApplied: false }
}