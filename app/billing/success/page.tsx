"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { 
  Check,
  CreditCard, 
  ChevronLeft,
  PlusCircle
} from "@/app/components/ui/icons"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { useSite } from "@/app/context/SiteContext"

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const credits = parseInt(searchParams.get('credits') || '0')
  const { currentSite, refreshSites } = useSite()
  
  useEffect(() => {
    // Refresh site data to get updated credit balance
    if (currentSite) {
      refreshSites()
    }
  }, [currentSite, refreshSites])

  return (
    <div className="min-h-screen bg-gradient-to-b from-background/40 to-background">
      <div className="container max-w-2xl px-4 py-16 mx-auto">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          
          <h1 className="text-3xl font-bold mb-2">Payment Successful!</h1>
          <p className="text-muted-foreground text-lg">
            Your credits have been added to your account
          </p>
        </div>

        <Card className="border border-border mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-green-600" />
              Purchase Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
                {currentSite?.billing?.credits_available || 0} credits
              </span>
            </div>
            
            <div className="border-t pt-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="font-medium mb-2 text-blue-700 dark:text-blue-400">What's Next?</h4>
                <ul className="text-sm space-y-1 text-blue-600 dark:text-blue-300">
                  <li>• Use credits for AI inference and automation</li>
                  <li>• Create campaigns and analyze performance</li>
                  <li>• Access premium features and integrations</li>
                  <li>• Monitor usage in your billing dashboard</li>
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
          <button 
            onClick={() => router.push('/checkout')}
            className="text-muted-foreground hover:text-foreground transition-colors text-sm underline"
          >
            Need more credits? Purchase additional credits
          </button>
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
} 