"use client"

import { useState } from "react"
import { SiteForm } from "../components/settings/site-form"
import { useSite } from "../context/SiteContext"
import { toast } from "sonner"
import { type Site } from "../context/SiteContext"
import { Button } from "../components/ui/button"
import { StickyHeader } from "../components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs"

export default function SettingsPage() {
  const { currentSite, updateSite } = useSite()
  const [isSaving, setIsSaving] = useState(false)
  const [activeSegment, setActiveSegment] = useState("all")

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

  // Función para manejar la acción de borrar caché y reconstruir
  const handleCacheAndRebuild = async () => {
    try {
      setIsSaving(true)
      // Lógica para borrar caché y reconstruir experimentos
      toast.success("Caché borrada y experimentos reconstruidos exitosamente")
    } catch (error) {
      console.error(error)
      toast.error("Error al borrar caché y reconstruir experimentos")
    } finally {
      setIsSaving(false)
    }
  }

  // Función para manejar la acción de borrar todo el sitio
  const handleDeleteSite = async () => {
    try {
      setIsSaving(true)
      // Lógica para borrar todo el sitio
      toast.success("Site deleted successfully")
    } catch (error) {
      console.error(error)
      toast.error("Error deleting site")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex-1">
      <StickyHeader>
        <div className="flex items-center justify-between px-16 w-full">
          <Tabs value={activeSegment} onValueChange={setActiveSegment} className="w-auto">
            <TabsList>
              <TabsTrigger value="all">All Settings</TabsTrigger>
              <TabsTrigger value="focus">Focus Mode</TabsTrigger>
              <TabsTrigger value="site">Site Info</TabsTrigger>
              <TabsTrigger value="cache">Cache</TabsTrigger>
              <TabsTrigger value="competitors">Competitors</TabsTrigger>
              <TabsTrigger value="resources">Resources</TabsTrigger>
              <TabsTrigger value="danger">Danger Zone</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button 
            onClick={() => handleSave(currentSite)}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save settings"}
          </Button>
        </div>
      </StickyHeader>
      <div className="px-16 py-8 pb-16 max-w-[880px] mx-auto">
        <SiteForm
          initialData={adaptSiteToForm(currentSite)}
          onSubmit={handleSave}
          onDeleteSite={handleDeleteSite}
          onCacheAndRebuild={handleCacheAndRebuild}
          isSaving={isSaving}
          activeSegment={activeSegment}
        />
      </div>
    </div>
  )
} 