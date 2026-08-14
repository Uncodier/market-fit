"use client"

import { useState, useEffect, Suspense } from "react"
import { toast } from "sonner"
import { useOptionalSite } from "@/app/context/SiteContext"
import { SiteOnboarding } from "../components/onboarding/site-onboarding"
import { SiteOnboardingSkeleton } from "../components/onboarding/site-onboarding-skeleton"
import { useAuth } from "../hooks/use-auth"
import { useRouter, useSearchParams } from "next/navigation"
import { apiClient } from "../services/api-client-service"
import { useSimpleRefreshPrevention } from "../hooks/use-prevent-refresh"
import { getCreateSiteErrorMessage } from "../components/onboarding/utils/onboarding-submit"
import { reloadForNewBuild } from "../components/ChunkErrorGuard"
import { isDemoSiteId } from "@/lib/demo-utils"

function CreateSitePageContent() {
  const [isSaving, setIsSaving] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [createdSiteId, setCreatedSiteId] = useState<string>("")
  const siteContext = useOptionalSite()
  const { user } = useAuth()
  const router = useRouter()
  useSearchParams()

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

  const { createSite, setCurrentSite, sites, isLoading: sitesLoading } = siteContext

  // Only show loading if still loading sites AND we haven't successfully created a site yet
  // AND we're not currently saving a site (to prevent the "jump" to loading screen when creating)
  // This prevents the loading screen from appearing over the success message or during site creation
  if (sitesLoading && !isSuccess && !isSaving) {
    return <SiteOnboardingSkeleton />
  }

  const handleComplete = async (data: any) => {
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
          swot: data.swot || {
            strengths: "",
            weaknesses: "",
            opportunities: "",
            threats: ""
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
          marketing_channels: data.marketing_channels || [],
          products: data.products || [],
          services: data.services || []
        }
      })
      
      setCreatedSiteId(newSite.id)
      setIsSuccess(true)
      setIsSaving(false)

      // Site setup is optional background work and must not block the success step
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || "market-fit-dev-api-key"
      const apiSecret = process.env.NEXT_PUBLIC_API_SECRET || "market-fit-dev-api-secret"
      void apiClient.postWithApiKeys(
        '/api/site/setup',
        { site_id: newSite.id },
        apiKey,
        apiSecret,
        { timeout: 15000 }
      ).then((setupResponse) => {
        if (!setupResponse.success) {
          console.warn("Site setup initiation failed:", setupResponse.error?.message)
        }
      }).catch((setupError) => {
        console.warn("Error initiating site setup:", setupError)
      })
    } catch (error) {
      console.error(error)
      toast.error(getCreateSiteErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const handleGoToDashboard = async () => {
    // First, set the created site as current site
    if (createdSiteId) {
      const createdSite = sites.find(site => site.id === createdSiteId)
      if (createdSite) {
        await setCurrentSite(createdSite)
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
    }
    router.push("/settings")
  }

  return (
    <div className="relative z-[9999]">
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
