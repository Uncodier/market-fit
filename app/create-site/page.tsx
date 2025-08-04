"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useSite } from "../context/SiteContext"
import { SiteOnboarding } from "../components/onboarding/site-onboarding"
import { useAuth } from "../hooks/use-auth"
import { useRouter } from "next/navigation"
import { apiClient } from "../services/api-client-service"

export default function CreateSitePage() {
  const [isSaving, setIsSaving] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [createdSiteId, setCreatedSiteId] = useState<string>("")
  const { createSite, setCurrentSite, sites } = useSite()
  const { user } = useAuth()
  const router = useRouter()

  const handleComplete = async (data: any) => {
    try {
      setIsSaving(true)
      
      // Debug: log the data being sent
      console.log("🔍 Onboarding form data received:", { 
        rawData: data,
        locations: data.locations,
        locationsWithRestrictions: data.locations?.map((loc: any) => ({
          name: loc.name,
          hasRestrictions: !!loc.restrictions,
          enabled: loc.restrictions?.enabled, // ⭐ CHECK IF BOOLEAN IS SAVED
          restrictions: loc.restrictions,
          includeCount: loc.restrictions?.included_addresses?.length || 0,
          excludeCount: loc.restrictions?.excluded_addresses?.length || 0
        }))
      })
      
      const newSite = await createSite({
        name: data.name,
        url: data.url || null,
        description: data.description || null,
        logo_url: data.logo_url || null,
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

      // Call site setup endpoint in background
      try {
        const apiKey = process.env.NEXT_PUBLIC_API_KEY || "market-fit-dev-api-key"
        const apiSecret = process.env.NEXT_PUBLIC_API_SECRET || "market-fit-dev-api-secret"
        
        console.log("Calling site setup endpoint for site:", newSite.id)
        
        const setupResponse = await apiClient.postWithApiKeys(
          '/api/site/setup',
          { site_id: newSite.id },
          apiKey,
          apiSecret
        )
        
        if (setupResponse.success) {
          console.log("Site setup initiated successfully")
        } else {
          console.warn("Site setup initiation failed:", setupResponse.error?.message)
          // Don't show error to user since this is background process
        }
      } catch (setupError) {
        console.warn("Error initiating site setup:", setupError)
        // Don't show error to user since this is background process
      }
      
    } catch (error) {
      console.error(error)
      toast.error("Error creating project")
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
    <SiteOnboarding 
      onComplete={handleComplete}
      isLoading={isSaving}
      isSuccess={isSuccess}
      createdSiteId={createdSiteId}
      onGoToDashboard={handleGoToDashboard}
      onGoToSettings={handleGoToSettings}
    />
  )
} 