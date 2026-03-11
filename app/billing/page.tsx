"use client"

import { useState, useEffect } from "react"
import { BillingForm } from "../components/billing/billing-form"
import { PaymentHistory } from "../components/billing/payment-history"
import { CreditUsageHistory } from "../components/billing/credit-usage-history"
import { BillingPageSkeleton } from "../components/billing/billing-skeleton"
import { useSite } from "../context/SiteContext"
import { StickyHeader } from "../components/ui/sticky-header"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { QuickNav, type QuickNavSection } from "@/app/components/ui/quick-nav"
import { useLocalization } from "@/app/context/LocalizationContext"

  // Section configurations for quick navigation
  const getBillingInfoSections = (t: (key: string) => string): QuickNavSection[] => [
    { id: "credits", title: t('billing.nav.credits') || "Credits" },
    { id: "subscription-plan", title: t('billing.nav.plan') || "Subscription Plan" },
    { id: "payment-method", title: t('billing.nav.payment') || "Payment Method" },
    { id: "tax-id", title: t('billing.nav.tax') || "Tax ID" },
    { id: "billing-address", title: t('billing.nav.address') || "Billing Address" },
  ]

  const getPaymentHistorySections = (t: (key: string) => string): QuickNavSection[] => [
    { id: "payment-history", title: t('billing.nav.history') || "Payment History" },
  ]

  const getCreditHistorySections = (t: (key: string) => string): QuickNavSection[] => [
    { id: "credit-history", title: t('billing.nav.creditHistory') || "Credit Usage History" },
  ]

export default function BillingPage() {
  const { t } = useLocalization()
  const { currentSite, isLoading } = useSite()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<string>("billing_info")
  
  // Get active tab from URL if present
  useEffect(() => {
    // Check if browser
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      if (tab === 'payment_history') {
        setActiveTab('payment_history')
      } else if (tab === 'credit_history') {
        setActiveTab('credit_history')
      }
    }
  }, [])

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    // Update URL without adding to history (prevents breadcrumb generation)
    const url = new URL(window.location.href)
    if (value === 'billing_info') {
      url.searchParams.delete('tab')
    } else {
      url.searchParams.set('tab', value)
    }
    window.history.replaceState({}, '', url.toString())
  }

  // Get current sections based on active tab
  const getCurrentSections = (): QuickNavSection[] => {
    switch (activeTab) {
      case "billing_info":
        return getBillingInfoSections(t)
      case "payment_history":
        return getPaymentHistorySections(t)
      case "credit_history":
        return getCreditHistorySections(t)
      default:
        return []
    }
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
        <p className="text-gray-500">{t('billing.noSite') || 'No site selected'}</p>
      </div>
    )
  }

  return (
    <div className="flex-1">
      <StickyHeader>
        <div className="flex items-center justify-between px-16 w-full">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-auto">
            <TabsList>
              <TabsTrigger value="billing_info">{t('billing.tabs.info') || 'Billing Info'}</TabsTrigger>
              <TabsTrigger value="payment_history">{t('billing.tabs.history') || 'Payment History'}</TabsTrigger>
              <TabsTrigger value="credit_history">{t('billing.tabs.credits') || 'Credit Usage History'}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </StickyHeader>
      <div className="py-8 pb-16">
        <div className="flex gap-8 justify-center max-w-[1200px] mx-auto">
          <div className="flex-1 max-w-[880px] px-16">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsContent value="billing_info" className="mt-0 p-0">
                <BillingForm 
                  initialData={{
                    plan: currentSite.billing?.plan || "commission",
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
                />
              </TabsContent>
              
              <TabsContent value="payment_history" className="mt-0 p-0">
                <PaymentHistory />
              </TabsContent>
              
              <TabsContent value="credit_history" className="mt-0 p-0">
                <CreditUsageHistory />
              </TabsContent>
            </Tabs>
          </div>
          <QuickNav sections={getCurrentSections()} />
        </div>
      </div>
    </div>
  )
} 