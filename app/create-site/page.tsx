"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useSite } from "../context/SiteContext"
import { type SiteFormValues } from "@/lib/schemas/site"
import { SiteForm } from "../components/settings/site-form"
import { useAuth } from "../hooks/use-auth"
import { Button } from "../components/ui/button"
import { useRouter } from "next/navigation"
import { StickyHeader } from "../components/ui/sticky-header"

export default function CreateSitePage() {
  const [isSaving, setIsSaving] = useState(false)
  const { createSite } = useSite()
  const { user } = useAuth()
  const router = useRouter()

  const handleSubmit = async (data: SiteFormValues) => {
    try {
      setIsSaving(true)
      await createSite({
        name: data.name,
        url: data.url || null,
        description: data.description || null,
        logo_url: data.logo_url || null,
        resource_urls: data.resource_urls || [],
        user_id: user?.sub as string
      })
      toast.success("Site created successfully")
      router.push("/dashboard")
    } catch (error) {
      console.error(error)
      toast.error("Error creating site")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex-1">
      <StickyHeader className="border-t">
        <div className="flex items-center justify-end px-16 w-full">
          <Button 
            type="submit"
            form="create-site-form"
            disabled={isSaving}
          >
            {isSaving ? "Creating..." : "Create Site"}
          </Button>
        </div>
      </StickyHeader>
      <div className="px-16 py-8 pb-16 max-w-[880px] mx-auto">
        <SiteForm
          onSubmit={handleSubmit}
          isSaving={isSaving}
          activeSegment="all"
          showOnlyCreateCards={true}
          id="create-site-form"
        />
      </div>
    </div>
  )
} 