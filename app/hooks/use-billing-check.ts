import { useState, useEffect } from 'react'
import { useSite } from '@/app/context/SiteContext'

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
  const [isLoading, setIsLoading] = useState(true)

  // Check if user can start robot based on billing
  const checkBillingAccess = (): BillingCheckResult => {
    if (!currentSite?.billing) {
      return {
        canStartRobot: false,
        hasEnginePlan: false,
        hasActiveCredits: false,
        billingPlan: null,
        creditsAvailable: 0,
        isLoading: false
      }
    }

    const billing = currentSite.billing
    const plan = billing.plan
    const creditsAvailable = billing.credits_available || 0
    
    // Check if plan is engine, foundry or enterprise (paid plans)
    const hasEnginePlan = plan === 'engine' || plan === 'foundry' || plan === 'enterprise'
    
    // Check if has active credits
    const hasActiveCredits = creditsAvailable > 0
    
    // Can start robot if has engine+ plan OR has active credits
    const canStartRobot = hasEnginePlan || hasActiveCredits

    return {
      canStartRobot,
      hasEnginePlan,
      hasActiveCredits,
      billingPlan: plan,
      creditsAvailable,
      isLoading: false
    }
  }

  useEffect(() => {
    setIsLoading(false)
  }, [currentSite])

  return checkBillingAccess()
}
