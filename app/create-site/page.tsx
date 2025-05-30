"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useSite } from "../context/SiteContext"
import { SiteOnboarding } from "../components/onboarding/site-onboarding"
import { useAuth } from "../hooks/use-auth"
import { useRouter } from "next/navigation"

export default function CreateSitePage() {
  const [isSaving, setIsSaving] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [createdSiteId, setCreatedSiteId] = useState<string>("")
  const { createSite } = useSite()
  const { user } = useAuth()
  const router = useRouter()

  const handleComplete = async (data: any) => {
    try {
      setIsSaving(true)
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
    } catch (error) {
      console.error(error)
      toast.error("Error creating project")
    } finally {
      setIsSaving(false)
    }
  }

  const handleGoToDashboard = () => {
    router.push("/dashboard")
  }

  const handleGoToSettings = () => {
    router.push("/settings")
  }

  return (
    <SiteOnboarding 
      onComplete={handleComplete}
      isLoading={isSaving}
      isSuccess={isSuccess}
      createdSiteId={createdSiteId}
    />
  )
} 