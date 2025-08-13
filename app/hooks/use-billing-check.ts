import { useState, useEffect } from 'react'
import { useSite } from '@/app/context/SiteContext'

export interface BillingCheckResult {
  canStartRobot: boolean
  hasStartupPlan: boolean
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
        hasStartupPlan: false,
        hasActiveCredits: false,
        billingPlan: null,
        creditsAvailable: 0,
        isLoading: false
      }
    }

    const billing = currentSite.billing
    const plan = billing.plan
    const creditsAvailable = billing.credits_available || 0
    
    // Check if plan is startup or enterprise (paid plans)
    const hasStartupPlan = plan === 'startup' || plan === 'enterprise'
    
    // Check if has active credits
    const hasActiveCredits = creditsAvailable > 0
    
    // Can start robot if has startup+ plan OR has active credits
    const canStartRobot = hasStartupPlan || hasActiveCredits

    return {
      canStartRobot,
      hasStartupPlan,
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
