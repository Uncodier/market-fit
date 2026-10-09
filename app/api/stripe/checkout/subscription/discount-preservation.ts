import type Stripe from 'stripe'
import { SubscriptionRequestError } from '@/lib/subscription-pricing.server'
import { stripeObjectId } from '@/app/api/stripe/webhook/subscription-billing'

/** Reuse Discount identities, never their coupon/code (which would reset duration). */
export function retainedDiscounts(values: (string | Stripe.Discount)[] | null | undefined) {
  const result = (values ?? []).map(value => {
    const id = stripeObjectId(value)
    if (!id || !/^di_[A-Za-z0-9_]+$/.test(id)) {
      throw new SubscriptionRequestError('Existing subscription discounts require billing support to preserve their terms; no change was made', 409)
    }
    return { discount: id }
  })
  if (new Set(result.map(value => value.discount)).size !== result.length) {
    throw new SubscriptionRequestError('Duplicate subscription discounts require billing support', 409)
  }
  return result
}

/** A schedule phase may reuse only the exact existing discount identities and order. */
export function verifyPhaseDiscounts(
  values: Stripe.SubscriptionSchedule.Phase.Discount[] | null | undefined,
  expected: ReturnType<typeof retainedDiscounts>,
): void {
  const ids = (values ?? []).map(value => stripeObjectId(value.discount))
  if (ids.length !== expected.length || ids.some((id, index) => id !== expected[index].discount)) {
    throw new SubscriptionRequestError('Scheduled discounts require billing support to preserve their terms', 409)
  }
}

export function phaseDiscountFields(values: ReturnType<typeof retainedDiscounts>) {
  return values.length ? { discounts: values } : {}
}