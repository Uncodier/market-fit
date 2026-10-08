import type { BillingInterval } from '@/lib/billing-pricing'
import type { BillingPlan } from './subscription-plans'

/** Hosted confirmation supports only interval changes on existing single-base subscriptions. */
export function requiresSubscriptionManagement(currentPlan: BillingPlan, targetPlan: BillingPlan,
  currentInterval: BillingInterval, targetInterval: BillingInterval) {
  return currentPlan !== 'commission' && (targetPlan === 'commission' ||
    (targetPlan !== currentPlan && currentInterval === targetInterval))
}