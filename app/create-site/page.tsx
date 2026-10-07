"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { toast } from "sonner"
import { useOptionalSite } from "@/app/context/SiteContext"
import { SiteOnboarding } from "../components/onboarding/site-onboarding"
import { SiteOnboardingSkeleton } from "../components/onboarding/site-onboarding-skeleton"
import { useAuth } from "../hooks/use-auth"
import { useRouter, useSearchParams } from "next/navigation"
import { siteSetupStore } from "./site-setup-store"
import { SiteSetupTracking } from "./site-setup-tracking"
import { useSimpleRefreshPrevention } from "../hooks/use-prevent-refresh"
import { getCreateSiteErrorMessage } from "../components/onboarding/utils/onboarding-submit"
import { reloadForNewBuild } from "../components/ChunkErrorGuard"
import { isDemoSiteId } from "@/lib/demo-utils"
import { prepareSiteBilling } from "@/app/services/initialize-site-billing"
import { BillingSetupWarning } from "@/app/components/billing/billing-setup-warning"
import type { SiteOnboardingValues } from "../components/onboarding/schemas/onboarding-schema"

function CreateSitePageContent() {
  const [isSaving, setIsSaving] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [createdSiteId, setCreatedSiteId] = useState<string>("")
  const [billingWarning, setBillingWarning] = useState<string | null>(null)
  const [isRetryingBilling, setIsRetryingBilling] = useState(false)
  const submissionStarted = useRef(false)
  const billingRetryStarted = useRef(false)
  const siteContext = useOptionalSite()
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const applyLicense = searchParams?.get('applyLicense')

  // Simple refresh prevention specifically for create-site page
  useSimpleRefreshPrevention()

  // Allow manual access to create-site even with existing sites
  useEffect(() => {
    // Set a flag to indicate this is intentional access
    sessionStorage.setItem('intentional_create_site_access', 'true')
    
    // Clean up the flag when leaving the page
    return () => {
      sessionStorage.removeItem('intentional_create_site_access')
    }
  }, [])

  useEffect(() => {
    if (!siteContext) {
      reloadForNewBuild()
    }
  }, [siteContext])

  if (!siteContext) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background/40 to-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Refreshing project setup...</p>
          <button
            type="button"
            className="text-sm underline text-muted-foreground hover:text-foreground"
            onClick={() => window.location.reload()}
          >
            Refresh page
          </button>
        </div>
      </div>
    )
  }

  const { createSite, setCurrentSite, refreshSiteBilling, sites, isLoading: sitesLoading } = siteContext

  // Only show loading if still loading sites AND we haven't successfully created a site yet
  // AND we're not currently saving a site (to prevent the "jump" to loading screen when creating)
  // This prevents the loading screen from appearing over the success message or during site creation
  if (sitesLoading && !isSuccess && !isSaving) {
    return <SiteOnboardingSkeleton />
  }

  const handleComplete = async (data: SiteOnboardingValues) => {
    if (submissionStarted.current) return
    submissionStarted.current = true
    try {
      setIsSaving(true)
      
      const newSite = await createSite({
        name: data.name,
        url: data.url || null,
        description: data.description || null,
        logo_url:
          typeof data.logo_url === "string" &&
          data.logo_url.startsWith("data:") &&
          data.logo_url.length > 100000
            ? null
            : data.logo_url || null,
        resource_urls: [],
        user_id: user?.id as string,
        settings: {
          focus_mode: data.focusMode,
          about: data.about || "",
          company_size: data.company_size || "",
          industry: data.industry || "",
          business_hours: data.business_hours || [],
          locations: data.locations || [],
          swot: {
            strengths: data.swot?.strengths || "",
            weaknesses: data.swot?.weaknesses || "",
            opportunities: data.swot?.opportunities || "",
            threats: data.swot?.threats || ""
          },
          goals: {
            quarterly: data.goals?.quarterly || "",
            yearly: data.goals?.yearly || "",
            fiveYear: data.goals?.fiveYear || "",
            tenYear: data.goals?.tenYear || ""
          },
          marketing_budget: {
            total: data.marketing_budget?.total || 0,
            available: data.marketing_budget?.available || 0
          },
          marketing_channels: (data.marketing_channels || []).map(channel => ({ ...channel, status: "active" })),
          products: data.products || [],
          services: data.services || []
        }
      })
      
      setCreatedSiteId(newSite.id)
      // The insert has succeeded. Billing failures must never return to project creation.
      const warning = await prepareSiteBilling(newSite.id, refreshSiteBilling)
      setBillingWarning(warning)
      if (warning) toast.warning(warning)
      setIsSuccess(true)
      setIsSaving(false)

      // Site setup is optional background work and must not block the success step
      // The store owns this promise so navigation/unmount cannot discard its result.
      if (user?.id) void siteSetupStore.launch(user.id, newSite.id)
    } catch (error) {
      submissionStarted.current = false
      console.error(error)
      toast.error(getCreateSiteErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const retryBilling = async () => {
    if (!createdSiteId || billingRetryStarted.current) return
    billingRetryStarted.current = true
    setIsRetryingBilling(true)
    const warning = await prepareSiteBilling(createdSiteId, refreshSiteBilling)
    setBillingWarning(warning)
    if (warning) toast.warning(warning)
    else toast.success("Billing setup confirmed. Credits refreshed.")
    setIsRetryingBilling(false)
    billingRetryStarted.current = false
  }

  const handleGoToDashboard = async () => {
    // First, set the created site as current site
    if (createdSiteId) {
      const createdSite = sites.find(site => site.id === createdSiteId)
      if (createdSite) {
        await setCurrentSite(createdSite)
      }
      
      if (applyLicense) {
        try {
          await fetch('/api/partner-license/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ license_key: applyLicense, site_id: createdSiteId }),
          })
        } catch (err) {
          console.error("Failed to auto-apply license:", err)
        }
      }
    }
    router.push("/dashboard")
  }

  const handleGoToSettings = async () => {
    // First, set the created site as current site
    if (createdSiteId) {
      const createdSite = sites.find(site => site.id === createdSiteId)
      if (createdSite) {
        await setCurrentSite(createdSite)
      }
      
      if (applyLicense) {
        try {
          await fetch('/api/partner-license/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ license_key: applyLicense, site_id: createdSiteId }),
          })
        } catch (err) {
          console.error("Failed to auto-apply license:", err)
        }
      }
    }
    router.push("/settings")
  }

  return (
    <div className="relative z-[9999]">
      {billingWarning && <div className="max-w-3xl mx-auto px-4">
        <BillingSetupWarning message={billingWarning} isLoading={isRetryingBilling} onRetry={() => void retryBilling()} />
      </div>}
      {createdSiteId && <div className="max-w-3xl mx-auto px-4">
        <SiteSetupTracking siteId={createdSiteId} />
      </div>}
      <SiteOnboarding 
        onComplete={handleComplete}
        isLoading={isSaving}
        isSuccess={isSuccess}
        createdSiteId={createdSiteId}
        onGoToDashboard={handleGoToDashboard}
        onGoToSettings={handleGoToSettings}
        hasExistingSites={(sites || []).some((site) => !isDemoSiteId(site.id))}
      />
    </div>
  )
}

export default function CreateSitePage() {
  return (
    <Suspense fallback={<SiteOnboardingSkeleton />}>
      <CreateSitePageContent />
    </Suspense>
  )
}
