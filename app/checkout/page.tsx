"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { 
  Check,
  CreditCard, 
  Lock,
  Shield,
  ChevronLeft,
  PlusCircle
} from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Badge } from "@/app/components/ui/badge"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"

interface CreditPackage {
  credits: number
  price: number
  pricePerCredit: number
  discount?: string
  popular?: boolean
}

const creditPackages: CreditPackage[] = [
  {
    credits: 20,
    price: 20,
    pricePerCredit: 1.00
  },
  {
    credits: 52,
    price: 49.25,
    pricePerCredit: 0.95,
    discount: "1.5% discount",
    popular: true
  },
  {
    credits: 515,
    price: 500,
    pricePerCredit: 0.97,
    discount: "3% discount"
  }
]

function CheckoutContent() {
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
      toast.error("You must be logged in to purchase credits")
      return
    }

    if (!currentSite) {
      toast.error("Please select a site first")
      return
    }

    if (!selectedPackage) {
      toast.error("Package selection error. Please refresh and try again.")
      return
    }

    // Additional validation for user email
    if (!user.email) {
      toast.error("User email is required for checkout")
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

    } catch (error: any) {
      console.error('Checkout error:', error)
      
      // Provide more specific error messages
      let errorMessage = "Failed to start checkout. Please try again."
      
      if (error.message?.includes('STRIPE_SECRET_KEY') || error.message?.includes('Stripe')) {
        errorMessage = "Payment service configuration error. Please contact support."
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = "Network error. Please check your connection and try again."
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast.error(errorMessage)
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
            <h2 className="text-xl font-semibold mb-2">No Site Selected</h2>
            <p className="text-muted-foreground mb-6">
              Please select a site from your available sites to continue with the purchase.
            </p>
          </div>
          <div className="space-y-3">
            <Button onClick={() => router.push('/dashboard')} className="w-full">
              Go to Dashboard
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
            <h2 className="text-xl font-semibold mb-2">No Sites Available</h2>
            <p className="text-muted-foreground mb-6">
              You need to have a site set up before purchasing credits. Please create a site first.
            </p>
          </div>
          <div className="space-y-3">
            <Button onClick={() => router.push('/create-site')} className="w-full">
              Create New Site
            </Button>
            <Button variant="outline" onClick={() => router.push('/dashboard')} className="w-full">
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background/40 to-background">
      <div className="container max-w-4xl px-4 py-8 mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <button 
            onClick={() => router.push('/billing')} 
            className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Back to Billing
          </button>
          <div className="flex items-center">
            <span className="text-xl font-medium">Uncodie</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column - Package Details */}
          <div>
            <h1 className="text-2xl font-medium mb-4">Purchase Credits</h1>
            <h2 className="text-4xl font-bold mb-8">${selectedPackage.price.toFixed(2)}</h2>
            
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="h-5 w-5" />
                  Credit Package Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Credits</span>
                  <span className="text-xl font-bold">{selectedPackage.credits}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Price per credit</span>
                  <span>${selectedPackage.pricePerCredit.toFixed(2)}</span>
                </div>
                
                {selectedPackage.discount && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Discount</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      {selectedPackage.discount}
                    </Badge>
                  </div>
                )}
                
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center text-lg font-semibold">
                    <span>Total</span>
                    <span>${selectedPackage.price.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Package Comparison */}
            <div className="mt-8">
              <h3 className="font-medium mb-4">Other Available Packages</h3>
              <div className="grid grid-cols-1 gap-3">
                {creditPackages.map((pkg) => (
                  <div 
                    key={pkg.credits}
                    className={`border rounded-lg p-4 cursor-pointer transition-all hover:border-blue-300 ${
                      pkg.credits === selectedPackage.credits ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => {
                      router.push(`/checkout?credits=${pkg.credits}`)
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{pkg.credits} Credits</div>
                        <div className="text-sm text-muted-foreground">${pkg.pricePerCredit.toFixed(2)} per credit</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">${pkg.price.toFixed(2)}</div>
                        {pkg.discount && (
                          <div className="text-xs text-green-600">{pkg.discount}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Checkout */}
          <div>
            <h2 className="text-2xl font-medium mb-6">Secure Checkout</h2>
            
            {/* Stripe Checkout Benefits */}
            <div className="bg-muted/30 rounded-lg p-6 mb-6 border border-border/30">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Powered by Stripe
              </h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Industry-leading security and encryption</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Multiple payment methods supported</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>3D Secure authentication included</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>PCI DSS compliant payment processing</span>
                </li>
              </ul>
            </div>

            {/* User Information */}
            {user && (
              <div className="bg-muted/20 rounded-lg p-4 mb-6 border border-border/20">
                <h4 className="font-medium mb-2">Account Information</h4>
                <div className="text-sm text-muted-foreground">
                  <p>Logged in as: {user.email}</p>
                  <p>Credits will be added to: {currentSite?.name}</p>
                </div>
              </div>
            )}

            {/* What happens next */}
            <div className="bg-primary/5 rounded-lg p-4 mb-6 border border-primary/20">
              <h4 className="font-medium mb-3 text-primary">What happens next?</h4>
              <ol className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">1</span>
                  <span>Secure payment processing via Stripe</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">2</span>
                  <span>Credits instantly added to your account</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">3</span>
                  <span>Start using credits immediately</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">4</span>
                  <span>Email confirmation with receipt</span>
                </li>
              </ol>
            </div>
              
            <Button 
              className="w-full h-12 text-base"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-pulse bg-muted rounded" />
                  Redirecting to Checkout...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Purchase {selectedPackage.credits} Credits
                </>
              )}
            </Button>
            
            <div className="flex justify-center items-center gap-2 text-sm text-muted-foreground mt-4">
              <Shield className="h-4 w-4" />
              256-bit SSL encryption | PCI DSS compliant
            </div>
            
            <div className="flex justify-center items-center gap-4 mt-4">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Stripe_Logo%2C_revised_2016.svg/1200px-Stripe_Logo%2C_revised_2016.svg.png"
                alt="Stripe" 
                className="h-6 w-auto opacity-60" 
              />
              <span className="text-xs text-muted-foreground">Trusted by millions worldwide</span>
            </div>
          </div>
        </div>
      </div>
    </div>
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