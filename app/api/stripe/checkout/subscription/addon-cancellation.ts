import type Stripe from 'stripe'
import { SubscriptionRequestError } from '@/lib/subscription-pricing.server'
import { stripeObjectId } from '@/app/api/stripe/webhook/subscription-billing'

/** Free has no base to retain at quantity zero; cancel the paid item at renewal. */
export async function cancelFreeAddonsAtRenewal(params: {
  stripe: Stripe; sub: Stripe.Subscription; addonItem?: Stripe.SubscriptionItem
  customerId: string; requiredAddons?: number; beforeProviderWrite: () => void
}) {
  const { stripe, sub, addonItem, customerId } = params
  const review = () => new SubscriptionRequestError('Add-on cancellation requires billing support to verify', 409)
  const end = addonItem?.current_period_end
  if (!addonItem || !Number.isSafeInteger(end) || end! <= Math.floor(Date.now() / 1000) ||
      !Number.isSafeInteger(addonItem.current_period_start) || addonItem.current_period_start >= end! ||
      sub.pending_update || sub.schedule || (params.requiredAddons ?? 0) > 0 ||
      sub.items.has_more || sub.items.data.length !== 1 || sub.items.data[0].id !== addonItem.id ||
      (sub.cancel_at && sub.cancel_at !== end)) throw review()
  const result = { flow: 'scheduled_addon_reduction' as const, effectiveAt: new Date(end! * 1000).toISOString() }
  if (sub.cancel_at_period_end) return result
  params.beforeProviderWrite()
  const updated = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true },
    { idempotencyKey: `addon-cancel-${customerId}-${sub.id}-${end}` })
  if (updated.id !== sub.id || stripeObjectId(updated.customer) !== customerId || updated.status !== 'active' ||
      !updated.cancel_at_period_end || (updated.cancel_at && updated.cancel_at !== end) ||
      updated.pending_update || updated.schedule || updated.items?.has_more || updated.items?.data.length !== 1 ||
      updated.items.data[0].id !== addonItem.id || updated.items.data[0].price.id !== addonItem.price.id ||
      updated.items.data[0].quantity !== addonItem.quantity || updated.items.data[0].current_period_end !== end) throw review()
  return result
}