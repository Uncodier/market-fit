import { useSite } from '@/app/context/SiteContext'
import { useCreditPeriodActive } from './use-credit-period-active'
import { spendableCredits } from '@/lib/billing/spendable-credits'

export interface BillingCheckResult {
  canStartRobot: boolean
  hasEnginePlan: boolean
  hasActiveCredits: boolean
  billingPlan: string | null
  creditsAvailable: number
  isLoading: boolean
}

export function useBillingCheck(): BillingCheckResult {
  const { currentSite } = useSite()
  const billing = currentSite?.billing
  // Recheck stale context balances at their boundaries, including tab wake-up.
  useCreditPeriodActive(billing?.trial_started_at, billing?.trial_ends_at)
  useCreditPeriodActive(billing?.plan_credit_period_start, billing?.plan_credit_period_end)
  useCreditPeriodActive(billing?.plan_credit_period_start, billing?.paid_subscription_period_end)

  // Check if user can start robot based on billing
  const checkBillingAccess = (): BillingCheckResult => {
    if (!billing || currentSite?.billing_read_status === 'unavailable' || currentSite?.billing_read_status === 'missing') {
      return {
        canStartRobot: false,
        hasEnginePlan: false,
        hasActiveCredits: false,
        billingPlan: null,
        creditsAvailable: 0,
        isLoading: false
      }
    }

    const plan = billing.plan
    const spendable = spendableCredits(billing)
    const creditsAvailable = spendable ?? 0
    
    // Check if plan is engine, foundry or enterprise (paid plans)
    const hasEnginePlan = plan === 'engine' || plan === 'foundry' || plan === 'enterprise'
    
    // Check if has active credits
    const hasActiveCredits = creditsAvailable > 0
    
    // Can start robot if has engine+ plan OR has active credits
    const canStartRobot = spendable !== null && (hasEnginePlan || hasActiveCredits)

    return {
      canStartRobot,
      hasEnginePlan,
      hasActiveCredits,
      billingPlan: plan,
      creditsAvailable,
      isLoading: false
    }
  }

  return checkBillingAccess()
}
