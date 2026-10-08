"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { 
  Check,
  CreditCard,
  Mail,
  ArrowRight
} from "@/app/components/ui/icons"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import { useSite } from "@/app/context/SiteContext"
import { formatPrice, parseBillingInterval, subscriptionPrice } from "@/lib/billing-pricing"

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const credits = parseInt(searchParams.get('credits') || '0')
  const plan = searchParams.get('plan')
  const { currentSite, refreshSites } = useSite()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentDate, setCurrentDate] = useState('')
  
  // Determine transaction type
  const isSubscription = plan && ['engine', 'foundry', 'enterprise'].includes(plan)
  
  // Get plan details
  const planDetails = {
    engine: { name: 'Engine Plan', monthlyPrice: 23 },
    foundry: { name: 'Foundry Plan', monthlyPrice: 99 },
    enterprise: { name: 'Enterprise Plan', monthlyPrice: 500 }
  }
  
  const currentPlan = plan ? planDetails[plan as keyof typeof planDetails] : null
  // A return URL is not proof of settlement. Display only the persisted subscription.
  const interval = parseBillingInterval(currentSite?.billing?.billing_interval) ?? 'month'
  const confirmedPlan = !isRefreshing && currentSite?.billing?.plan === plan
  const price = currentPlan ? subscriptionPrice(currentPlan.monthlyPrice, interval) : null
  
  useEffect(() => {
    // Set formatted date
    setCurrentDate(new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(new Date()))

    // Refresh site data immediately when component mounts to get updated credit balance
    const refreshCredits = async () => {
      setIsRefreshing(true)
      try {
        await refreshSites()
      } catch (error) {
        console.error('Error refreshing sites:', error)
      } finally {
        setIsRefreshing(false)
      }
    }
    
    refreshCredits()
  }, [])

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-10">
          <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-8 shadow-sm">
            <Check className="h-10 w-10 text-green-600" strokeWidth={3} />
          </div>
          
          <h1 className="text-3xl font-bold tracking-tight mb-3">
            {isSubscription ? 'Subscription checkout returned' : 'Payment Successful!'}
          </h1>
          <p className="text-muted-foreground text-lg mb-6">
            {isSubscription 
              ? 'Your billing details update after payment confirmation. Review the current subscription below or on the billing page.'
              : 'Your credits have been added to your account'
            }
          </p>
        </div>

        <div className="bg-muted/30 border border-border rounded-xl p-6 mb-10 space-y-4">
          {isSubscription && currentPlan ? (
            <>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{currentPlan.name}</span>
              </div>
              
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Current plan price</span>
                <div className="text-right">
                  <span className="font-medium">{confirmedPlan && price ? `${formatPrice(price.total)}/${interval === 'year' ? 'year' : 'month'}` : 'Awaiting billing confirmation'}</span>
                  {confirmedPlan && price && interval === 'year' && <p className="text-xs text-muted-foreground">{formatPrice(price.monthlyEquivalent)}/month equivalent · billed annually</p>}
                  {confirmedPlan && <p className="text-xs text-muted-foreground">Credits remain monthly. Add-ons billed separately.</p>}
                </div>
              </div>
              
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Workspace</span>
                <span className="font-medium">{currentSite?.name}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">
                  {currentDate || <LoadingSkeleton variant="button" size="sm" />}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Credits Purchased</span>
                <span className="font-medium">+{credits}</span>
              </div>
              
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Workspace</span>
                <span className="font-medium">{currentSite?.name}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">
                  {currentDate || <LoadingSkeleton variant="button" size="sm" />}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">New Balance</span>
                <span className="font-bold text-foreground">
                  {isRefreshing ? (
                    <LoadingSkeleton variant="button" size="sm" />
                  ) : (
                    `${currentSite?.billing?.credits_available !== undefined ? currentSite.billing.credits_available : 0}`
                  )}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="space-y-6 text-center">
          <Button 
            size="lg"
            onClick={() => router.push('/dashboard')}
            className="w-full text-base h-12"
          >
            Continue to Dashboard
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Mail className="h-4 w-4" />
              A receipt has been sent to your email
            </span>
            <button 
              onClick={() => router.push('/billing?tab=payment_history')}
              className="hover:text-foreground transition-colors underline underline-offset-4 decoration-muted-foreground/30 flex items-center gap-1.5 mt-2"
            >
              <CreditCard className="h-3.5 w-3.5" />
              View payment history
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-background/40 to-background flex items-center justify-center">
        <div className="text-center">
          <LoadingSkeleton variant="fullscreen" size="md" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
} 