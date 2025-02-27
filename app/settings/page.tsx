"use client"

import { useState } from "react"
import { SiteForm } from "../components/settings/site-form"
import { useSite } from "../context/SiteContext"
import { toast } from "sonner"
import { type Site } from "../context/SiteContext"
import { Button } from "../components/ui/button"
import { StickyHeader } from "../components/ui/sticky-header"

export default function SettingsPage() {
  const { currentSite, updateSite } = useSite()
  const [isSaving, setIsSaving] = useState(false)

  // Adaptar Site a SiteFormValues para el formulario
  const adaptSiteToForm = (site: Site) => {
    return {
      name: site.name,
      url: site.url || "",
      description: site.description || "",
      logo_url: site.logo_url || "",
      resource_urls: site.resource_urls || [],
      // Valores por defecto para campos que no están en Site
      blogUrl: "",
      competitors: [{ url: "" }],
      focusMode: 50
    }
  }

  const handleSave = async (data: Partial<Site>) => {
    try {
      setIsSaving(true)
      // Aquí iría la lógica para guardar en Supabase
      await updateSite({
        ...currentSite,
        ...data,
        resource_urls: data.resource_urls?.filter(url => url.key && url.url) || []
      } as Site)
      toast.success("Settings saved successfully")
    } catch (error) {
      console.error(error)
      toast.error("Error saving settings")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex-1 p-0">
      <StickyHeader>
        <div className="flex items-center justify-between px-16 w-full">
          <div className="flex-1" />
          <Button 
            onClick={() => handleSave(currentSite)}
            disabled={isSaving}
          >
            {isSaving ? "Guardando..." : "Guardar configuración"}
          </Button>
        </div>
      </StickyHeader>
      <div className="px-16 py-8">
        <SiteForm
          initialData={adaptSiteToForm(currentSite)}
          onSubmit={handleSave}
        />
      </div>
    </div>
  )
} 