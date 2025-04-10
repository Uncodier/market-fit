"use client"

import { useState, useEffect } from "react"
import { BillingForm } from "../components/billing/billing-form"
import { PaymentHistory } from "../components/billing/payment-history"
import { BillingPageSkeleton, BillingInfoSkeleton, PaymentHistorySkeleton } from "../components/billing/billing-skeleton"
import { useSite } from "../context/SiteContext"
import { StickyHeader } from "../components/ui/sticky-header"
import { Button } from "../components/ui/button"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"

export default function BillingPage() {
  const { currentSite, isLoading } = useSite()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("billing_info")
  
  // Get active tab from URL if present
  useEffect(() => {
    // Check if browser
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      if (tab === 'payment_history') {
        setActiveTab('payment_history')
      }
    }
  }, [])

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    // Update URL
    const url = new URL(window.location.href)
    if (value === 'billing_info') {
      url.searchParams.delete('tab')
    } else {
      url.searchParams.set('tab', value)
    }
    window.history.pushState({}, '', url.toString())
  }

  // Redirect to dashboard if no site is selected
  useEffect(() => {
    if (!isLoading && !currentSite) {
      router.push('/dashboard')
    }
  }, [currentSite, isLoading, router])

  if (isLoading) {
    return <BillingPageSkeleton />
  }

  if (!currentSite) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">No site selected</p>
      </div>
    )
  }

  return (
    <div className="flex-1">
      <StickyHeader>
        <div className="flex items-center justify-between px-16 w-full">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-auto">
            <TabsList>
              <TabsTrigger value="billing_info">Billing Info</TabsTrigger>
              <TabsTrigger value="payment_history">Payment History</TabsTrigger>
            </TabsList>
          </Tabs>
          {activeTab === "billing_info" && (
            <Button 
              type="submit"
              form="billing-form"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Billing Info"}
            </Button>
          )}
        </div>
      </StickyHeader>
      <div className="px-16 py-8 pb-16 max-w-[880px] mx-auto">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsContent value="billing_info" className="mt-0 p-0">
            <BillingForm 
              id="billing-form"
              initialData={{
                plan: currentSite.billing?.plan || "free",
                card_name: currentSite.billing?.card_name,
                card_expiry: currentSite.billing?.card_expiry,
                card_address: currentSite.billing?.card_address,
                card_city: currentSite.billing?.card_city,
                card_postal_code: currentSite.billing?.card_postal_code,
                card_country: currentSite.billing?.card_country,
                tax_id: currentSite.billing?.tax_id,
                billing_address: currentSite.billing?.billing_address,
                billing_city: currentSite.billing?.billing_city,
                billing_postal_code: currentSite.billing?.billing_postal_code,
                billing_country: currentSite.billing?.billing_country,
                auto_renew: currentSite.billing?.auto_renew === false ? false : true
              }}
              onSuccess={() => {
                router.push('/dashboard')
              }}
              onSubmitStart={() => setIsSubmitting(true)}
              onSubmitEnd={() => setIsSubmitting(false)}
            />
          </TabsContent>
          
          <TabsContent value="payment_history" className="mt-0 p-0">
            <PaymentHistory />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
} 