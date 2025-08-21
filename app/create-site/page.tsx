"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { useSite } from "../context/SiteContext"
import { SiteOnboarding } from "../components/onboarding/site-onboarding"
import { useAuth } from "../hooks/use-auth"
import { useRouter, useSearchParams } from "next/navigation"
import { apiClient } from "../services/api-client-service"

export default function CreateSitePage() {
  const [isSaving, setIsSaving] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [createdSiteId, setCreatedSiteId] = useState<string>("")
  const { createSite, setCurrentSite, sites, isLoading: sitesLoading } = useSite()
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasRedirectedRef = useRef(false)

  // Allow manual access to create-site even with existing sites
  useEffect(() => {
    // Set a flag to indicate this is intentional access
    sessionStorage.setItem('intentional_create_site_access', 'true')
    
    // Clean up the flag when leaving the page
    return () => {
      sessionStorage.removeItem('intentional_create_site_access')
    }
  }, [])

  // Simple redirect logic - only redirect if user has no sites and is loading
  useEffect(() => {
    // Don't do any redirects - let the user stay here if they navigated manually
    // The SiteContext will handle redirecting users with no sites TO this page
    // But we won't redirect them AWAY from this page
    console.log("Create-site page loaded - allowing access regardless of existing sites")
  }, [sitesLoading, sites.length, router, searchParams])

  // Only show loading if still loading sites
  if (sitesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background/40 to-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your sites...</p>
        </div>
      </div>
    )
  }

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