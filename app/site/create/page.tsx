"use client"

import { useState } from "react"
import { CreateSiteForm } from "@/app/components/site/create-site-form"
import { useSite } from "@/app/context/SiteContext"
import { toast } from "sonner"
import { type Site } from "@/app/context/SiteContext"
import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function CreateSitePage() {
  const { createSite } = useSite()
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleCreate = async (data: Partial<Site>) => {
    try {
      setIsSaving(true)
      
      // Verificar sesión del usuario
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user) {
        toast.error("Debes iniciar sesión para crear un sitio")
        router.push("/auth/login")
        return
      }

      const focusMode = data.focusMode || 50

      // Crear el sitio con el ID del usuario
      const newSite = await createSite({
        ...data,
        user_id: session.user.id,
        resource_urls: data.resource_urls?.filter(url => url.key && url.url) || [],
        competitors: data.competitors?.filter(comp => comp.url) || [],
        focusMode,
        focus_mode: focusMode
      } as Site)

      // Guardar focusMode en localStorage y seleccionar el sitio
      if (newSite?.id) {
        localStorage.setItem(`site_${newSite.id}_focusMode`, String(focusMode))
        localStorage.setItem("currentSiteId", newSite.id)
      }

      toast.success("Sitio creado exitosamente")
      router.push("/settings")
    } catch (error) {
      console.error("Error al crear el sitio:", error)
      toast.error(error instanceof Error ? error.message : "Error al crear el sitio")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex-1">
      <StickyHeader>
        <div className="flex items-center justify-end px-16 w-full">
          <Button 
            type="submit"
            form="create-site-form"
            disabled={isSaving}
          >
            {isSaving ? "Creating..." : "Create site"}
          </Button>
        </div>
      </StickyHeader>
      <div className="px-16 py-8 pb-16 max-w-[880px] mx-auto">
        <CreateSiteForm
          onSubmit={handleCreate}
          isSaving={isSaving}
        />
      </div>
    </div>
  )
} 