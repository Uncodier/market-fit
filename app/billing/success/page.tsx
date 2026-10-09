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
import { useLocalization } from "@/app/context/LocalizationContext"
import { formatPrice, parseBillingInterval, subscriptionPrice } from "@/lib/billing-pricing"

function SuccessContent() {
  const { t, locale } = useLocalization()
  const dateLocale = (locale ?? 'en') === 'en' ? 'en-US' : (locale ?? 'en')
  const router = useRouter()
  const searchParams = useSearchParams()
  const credits = parseInt(searchParams.get('credits') || '0')
  const plan = searchParams.get('plan')
  const { currentSite, refreshSites } = useSite()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentDate, setCurrentDate] = useState('')
  
  // Determine transaction type
  const isSubscription = plan && ['commission', 'engine', 'foundry', 'enterprise'].includes(plan)
  const isAddonOnly = plan === 'commission'
  
  // Get plan details
  const planDetails = {
    commission: { name: t('billing.success.freePlan') || 'Free Plan', monthlyPrice: 0 },
    engine: { name: t('billing.plan.engine.title') || 'Engine', monthlyPrice: 23 },
    foundry: { name: t('billing.plan.foundry.title') || 'Foundry', monthlyPrice: 99 },
    enterprise: { name: t('billing.plan.enterprise.title') || 'Enterprise', monthlyPrice: 500 }
  }
  
  const currentPlan = plan ? planDetails[plan as keyof typeof planDetails] : null
  // A return URL is not proof of settlement. Display only the persisted subscription.
  const interval = parseBillingInterval(currentSite?.billing?.billing_interval) ?? 'month'
  const addonsCount = currentSite?.billing?.addons_count || 0
  const confirmedPlan = !isRefreshing && currentSite?.billing?.plan === plan &&
    (!isAddonOnly || (addonsCount > 0 && !!currentSite?.billing?.paid_subscription_invoice_id &&
      currentSite.billing.paid_subscription_plan === 'commission' &&
      currentSite.billing.paid_subscription_addons_count === addonsCount))
  const price = currentPlan ? subscriptionPrice(isAddonOnly ? addonsCount * 10 : currentPlan.monthlyPrice, interval) : null
  const intervalLabel = interval === 'year'
    ? t('billing.interval.year') || 'year'
    : t('billing.interval.month') || 'month'
  
  useEffect(() => {
    // Reformat the date on locale changes without repeating the site refresh.
    setCurrentDate(new Intl.DateTimeFormat(dateLocale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(new Date()))
  }, [dateLocale])

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
    <div className="min-h-dvh flex items-center justify-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-10">
          <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-8 shadow-sm">
            <Check className="h-10 w-10 text-green-600" strokeWidth={3} />
          </div>
          
          <h1 className="text-3xl font-bold tracking-tight mb-3">
            {isSubscription
              ? t('billing.success.subscriptionTitle') || 'Subscription checkout returned'
              : t('billing.success.paymentTitle') || 'Payment Successful!'}
          </h1>
          <p className="text-muted-foreground text-lg mb-6">
            {isSubscription 
              ? t('billing.success.subscriptionDescription') || 'Your billing details update after payment confirmation. Review the current subscription below or on the billing page.'
              : t('billing.success.creditsDescription') || 'Your credits have been added to your account'
            }
          </p>
        </div>

        <div className="bg-muted/30 border border-border rounded-xl p-6 mb-10 space-y-4">
          {isSubscription && currentPlan ? (
            <>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">{t('billing.success.planLabel') || 'Plan'}</span>
                <span className="font-medium">{isAddonOnly ? currentPlan.name : t('billing.success.planName', { plan: currentPlan.name }) || `${currentPlan.name} Plan`}</span>
              </div>
              
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">{isAddonOnly ? 'Current add-on price' : t('billing.success.currentPrice') || 'Current plan price'}</span>
                <div className="text-right">
                  <span className="font-medium">{confirmedPlan && price ? `${formatPrice(price.total)}/${intervalLabel}` : t('billing.success.awaitingConfirmation') || 'Awaiting billing confirmation'}</span>
                  {confirmedPlan && price && interval === 'year' && <p className="text-xs text-muted-foreground">{t('billing.success.annualEquivalent', { price: formatPrice(price.monthlyEquivalent) }) || `${formatPrice(price.monthlyEquivalent)}/month equivalent · billed annually`}</p>}
                  {confirmedPlan && <p className="text-xs text-muted-foreground">{isAddonOnly
                    ? t('billing.success.freeAddons', { count: addonsCount }) || `Current add-ons: ${addonsCount}. Your base plan remains free.`
                    : t('billing.success.monthlyCredits') || 'Credits remain monthly. Add-ons billed separately.'}</p>}
                </div>
              </div>
              
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">{t('billing.success.workspace') || 'Workspace'}</span>
                <span className="font-medium">{currentSite?.name}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">{t('billing.payment.table.date') || 'Date'}</span>
                <span className="font-medium">
                  {currentDate || <LoadingSkeleton variant="button" size="sm" />}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">{t('billing.success.creditsPurchased') || 'Credits Purchased'}</span>
                <span className="font-medium">+{credits}</span>
              </div>
              
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">{t('billing.success.workspace') || 'Workspace'}</span>
                <span className="font-medium">{currentSite?.name}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">{t('billing.payment.table.date') || 'Date'}</span>
                <span className="font-medium">
                  {currentDate || <LoadingSkeleton variant="button" size="sm" />}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">{t('billing.success.newBalance') || 'New Balance'}</span>
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
            {t('billing.success.continue') || 'Continue to Dashboard'}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Mail className="h-4 w-4" />
              {t('billing.success.receiptSent') || 'A receipt has been sent to your email'}
            </span>
            <button 
              onClick={() => router.push('/billing?tab=payment_history')}
              className="hover:text-foreground transition-colors underline underline-offset-4 decoration-muted-foreground/30 flex items-center gap-1.5 mt-2"
            >
              <CreditCard className="h-3.5 w-3.5" />
              {t('billing.success.viewHistory') || 'View payment history'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BillingSuccessPage() {
  const { t } = useLocalization()
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-background/40 to-background flex items-center justify-center">
        <div className="text-center">
          <LoadingSkeleton variant="fullscreen" size="md" />
          <p className="text-muted-foreground">{t('billing.success.loading') || 'Loading...'}</p>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
} 