"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { toast } from "sonner"
import { PlusCircle } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { Card, CardContent, CardHeader } from "@/app/components/ui/card"
import { useLocalization } from "@/app/context/LocalizationContext"
import { creditPackages, type CreditPackage } from "./credit-packages"
import { CheckoutSummary } from "./CheckoutSummary"
import { localizeCheckoutError } from "./checkout-feedback"

function CheckoutContent() {
  const { t } = useLocalization()
  const router = useRouter()
  const searchParams = useSearchParams()
  const credits = parseInt(searchParams.get('credits') || '20')
  const { currentSite, isLoading: siteLoading, sites } = useSite()
  const { user } = useAuth()
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null)

  useEffect(() => {
    // Find the selected package based on credits parameter
    const pkg = creditPackages.find(p => p.credits === credits)
    setSelectedPackage(pkg || creditPackages[0])
  }, [credits])

  // Debug logging
  useEffect(() => {
    console.log('Checkout Debug:', {
      siteLoading,
      currentSite: currentSite?.name,
      sitesLength: sites.length,
      user: user?.email
    })
  }, [siteLoading, currentSite, sites.length, user])

  const handleSubmit = async () => {
    // Enhanced validation with specific error messages
    if (!user) {
      toast.error(t("commercePages.checkout.errors.loginRequired"))
      return
    }

    if (!currentSite) {
      toast.error(t("commercePages.checkout.errors.siteRequired"))
      return
    }

    if (!selectedPackage) {
      toast.error(t("commercePages.checkout.errors.packageSelection"))
      return
    }

    // Additional validation for user email
    if (!user.email) {
      toast.error(t("commercePages.checkout.errors.emailRequired"))
      return
    }

    console.log('Starting checkout with:', {
      user: user?.email,
      site: currentSite?.name,
      package: selectedPackage?.credits,
      amount: selectedPackage?.price
    })

    setIsSubmitting(true)
    try {
      // Create Stripe Checkout session for credits
      const response = await fetch('/api/stripe/checkout/credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credits: selectedPackage.credits,
          amount: selectedPackage.price,
          siteId: currentSite.id,
          userEmail: user.email,
          successUrl: `${window.location.origin}/billing/success?credits=${selectedPackage.credits}`,
          cancelUrl: `${window.location.origin}/billing?tab=billing_info`,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const { url, error } = await response.json()

      if (error) {
        throw new Error(error)
      }

      // Redirect to Stripe Checkout
      if (url) {
        console.log('Redirecting to Stripe checkout:', url)
        window.location.href = url
      } else {
        throw new Error('No checkout URL received from server')
      }

    } catch (error: unknown) {
      console.error('Checkout error:', error)
      
      toast.error(localizeCheckoutError(error, t))
      setIsSubmitting(false)
    }
  }

  // Show complete checkout skeleton while loading
  if (siteLoading || !selectedPackage || (!currentSite && sites.length === 0)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background/40 to-background">
        <div className="container max-w-4xl px-4 py-8 mx-auto">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center">
              <Skeleton className="h-5 w-5 mr-1" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column Skeleton */}
            <div>
              <Skeleton className="h-8 w-48 mb-4" />
              <Skeleton className="h-12 w-32 mb-8" />
              
              <Card className="border border-border">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5" />
                    <Skeleton className="h-6 w-40" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-5 w-12" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Package Comparison Skeleton */}
              <div className="mt-8">
                <Skeleton className="h-5 w-48 mb-4" />
                <div className="grid grid-cols-1 gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <Skeleton className="h-4 w-20 mb-1" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <div className="text-right">
                          <Skeleton className="h-4 w-16 mb-1" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column Skeleton */}
            <div>
              <Skeleton className="h-8 w-40 mb-6" />
              
              {/* Benefits Section Skeleton */}
              <div className="bg-muted/30 rounded-lg p-6 mb-6 border border-border/30">
                <div className="flex items-center gap-2 mb-4">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Skeleton className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              </div>

              {/* User Info Skeleton */}
              <div className="bg-muted/20 rounded-lg p-4 mb-6 border border-border/20">
                <Skeleton className="h-5 w-32 mb-2" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>

              {/* What happens next Skeleton */}
              <div className="bg-primary/5 rounded-lg p-4 mb-6 border border-primary/20">
                <Skeleton className="h-5 w-32 mb-3" />
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Skeleton className="h-5 w-5 rounded-full flex-shrink-0 mt-0.5" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              </div>
                
              <Skeleton className="w-full h-12" />
              
              <div className="flex justify-center items-center gap-2 mt-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-48" />
              </div>
              
              <div className="flex justify-center items-center gap-4 mt-4">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show message if no site is available but user has sites (just not selected)
  if (!currentSite && sites.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background/40 to-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mb-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <PlusCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">{t("commercePages.checkout.noSiteSelected")}</h2>
            <p className="text-muted-foreground mb-6">
              {t("commercePages.checkout.selectSiteDescription")}
            </p>
          </div>
          <div className="space-y-3">
            <Button onClick={() => router.push('/dashboard')} className="w-full">
              {t("commercePages.checkout.dashboard")}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Show message if no sites exist
  if (!currentSite && sites.length === 0 && !siteLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background/40 to-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mb-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <PlusCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">{t("commercePages.checkout.noSitesAvailable")}</h2>
            <p className="text-muted-foreground mb-6">
              {t("commercePages.checkout.createSiteDescription")}
            </p>
          </div>
          <div className="space-y-3">
            <Button onClick={() => router.push('/create-site')} className="w-full">
              {t("commercePages.checkout.createSite")}
            </Button>
            <Button variant="outline" onClick={() => router.push('/dashboard')} className="w-full">
              {t("commercePages.checkout.dashboard")}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <CheckoutSummary
      selectedPackage={selectedPackage}
      isSubmitting={isSubmitting}
      showAccountInformation={Boolean(user)}
      userEmail={user?.email}
      siteName={currentSite?.name}
      onSubmit={handleSubmit}
      onNavigate={(href) => router.push(href)}
    />
  )
}

export default function CreditsCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-background/40 to-background flex items-center justify-center">
        <div className="text-center">
          <Skeleton className="h-8 w-48 mx-auto mb-4" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
} 