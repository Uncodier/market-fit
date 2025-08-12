"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { 
  Check,
  CreditCard, 
  ChevronLeft,
  PlusCircle,
  Star
} from "@/app/components/ui/icons"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import { useSite } from "@/app/context/SiteContext"

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const credits = parseInt(searchParams.get('credits') || '0')
  const plan = searchParams.get('plan')
  const { currentSite, refreshSites } = useSite()
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Determine transaction type
  const isCreditsPurchase = credits > 0
  const isSubscription = plan && ['startup', 'enterprise'].includes(plan)
  
  // Get plan details
  const planDetails = {
    startup: { name: 'Startup Plan', price: '$99/month', features: ['Advanced analytics', 'Priority support', 'Custom integrations'] },
    enterprise: { name: 'Enterprise Plan', price: '$500/month', features: ['All Startup features', 'Dedicated account manager', 'White-label options', 'Custom development'] }
  }
  
  const currentPlan = plan ? planDetails[plan as keyof typeof planDetails] : null
  
  useEffect(() => {
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
    <div className="min-h-screen bg-gradient-to-b from-background/40 to-background">
      <div className="container max-w-2xl px-4 py-16 mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          
          <h1 className="text-3xl font-bold mb-2">
            {isSubscription ? 'Welcome to Premium!' : 'Payment Successful!'}
          </h1>
          <p className="text-muted-foreground text-lg">
            {isSubscription 
              ? `Your ${currentPlan?.name || 'subscription'} has been activated successfully` 
              : 'Your credits have been added to your account'
            }
          </p>
        </div>

        <Card className="border border-border mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isSubscription ? (
                <Star className="h-5 w-5 text-green-600" />
              ) : (
                <PlusCircle className="h-5 w-5 text-green-600" />
              )}
              {isSubscription ? 'Subscription Details' : 'Purchase Details'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isSubscription && currentPlan ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Plan Activated</span>
                  <Badge variant="secondary" className="bg-gradient-to-r from-green-100 to-blue-100 text-green-800 text-lg px-4 py-2 border border-green-200">
                    <Star className="h-4 w-4 mr-2" />
                    {currentPlan.name}
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Monthly Cost</span>
                  <span className="text-2xl font-bold">{currentPlan.price}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Site</span>
                  <span className="font-medium">{currentSite?.name}</span>
                </div>
                
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Plan Features:</h4>
                  <ul className="space-y-2">
                    {currentPlan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Credits Purchased</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 text-lg px-4 py-2">
                    +{credits} credits
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Added to Account</span>
                  <span className="font-medium">{currentSite?.name}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Current Balance</span>
                  <span className="text-2xl font-bold">
                    {isRefreshing ? (
                      <span className="flex items-center gap-2">
                        <LoadingSkeleton variant="button" size="sm" />
                        Updating...
                      </span>
                    ) : (
                      `${currentSite?.billing?.credits_available !== undefined ? currentSite.billing.credits_available : 0} credits`
                    )}
                  </span>
                </div>
              </>
            )}
            
            <div className="border-t pt-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="font-medium mb-2 text-blue-700 dark:text-blue-400">What's Next?</h4>
                <ul className="text-sm space-y-1 text-blue-600 dark:text-blue-300">
                  {isSubscription ? (
                    <>
                      <li>• Access all premium features immediately</li>
                      <li>• Set up advanced automation workflows</li>
                      <li>• Contact support for onboarding assistance</li>
                      <li>• Manage your subscription in billing settings</li>
                    </>
                  ) : (
                    <>
                      <li>• Use credits for AI inference and automation</li>
                      <li>• Create campaigns and analyze performance</li>
                      <li>• Access premium features and integrations</li>
                      <li>• Monitor usage in your billing dashboard</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            onClick={() => router.push('/dashboard')}
            className="flex-1 sm:flex-none"
          >
            Go to Dashboard
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => router.push('/billing?tab=payment_history')}
            className="flex-1 sm:flex-none"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            View Payment History
          </Button>
        </div>

        <div className="text-center mt-8">
          {isSubscription ? (
            <button 
              onClick={() => router.push('/billing')}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm underline"
            >
              Manage your subscription in billing settings
            </button>
          ) : (
            <button 
              onClick={() => router.push('/checkout')}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm underline"
            >
              Need more credits? Purchase additional credits
            </button>
          )}
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