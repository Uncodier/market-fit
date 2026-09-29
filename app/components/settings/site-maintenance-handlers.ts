import { toast } from "sonner"
import { type Site } from "../../context/SiteContext"
import { createClient } from "@/lib/supabase/client"



export const handleCacheAndRebuild = async (setIsSaving: (saving: boolean) => void, currentSite?: Site, user?: any) => {
  try {
    setIsSaving(true)
    
    if (!currentSite?.id || !user?.id) {
      toast.error("Missing site or user information")
      return
    }

    if (!currentSite.url) {
      toast.error("Site URL is missing. Please add a URL to your site in the settings.")
      return
    }

    // Step 1: Delete all analysis records for the current site
    const supabase = createClient()
    console.log("Deleting analysis records for site:", currentSite.id)
    
    const { error: deleteError } = await supabase
      .from('analysis')
      .delete()
      .eq('site_id', currentSite.id)
    
    if (deleteError) {
      console.error("Error deleting analysis records:", deleteError)
      toast.error("Failed to clear analysis cache")
      return
    }
    
    console.log("Analysis records deleted successfully")
    
    // Step 2: Call the siteAnalysis workflow
    console.log("Starting siteAnalysis workflow for site:", currentSite.id)
    
    const { apiClient } = await import('@/app/services/api-client-service')
    
    const response = await apiClient.post('/api/workflow/analyzeSite', {
      user_id: user.id,
      site_id: currentSite.id,
      url: currentSite.url,
      provider: "openai",
      modelId: "gpt-4o",
      includeScreenshot: true
    })
    
    if (response.success) {
      console.log('SiteAnalysis workflow completed successfully:', response.data)
      toast.success("Cache cleared and site analysis completed successfully")
    } else {
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : response.error?.message 
        ? String(response.error.message)
        : 'Failed to run site analysis'
      console.error('SiteAnalysis workflow failed:', response.error)
      toast.error(`Cache cleared but analysis failed: ${errorMessage}`)
    }
    
  } catch (error) {
    console.error("Error in cache and rebuild:", error)
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
      ? error 
      : 'An error occurred while clearing cache and rebuilding'
    toast.error(errorMessage)
  } finally {
    setIsSaving(false)
  }
}

export const handleDeleteSite = async (
  currentSite: Site | null, 
  deleteSite: (siteId: string) => Promise<void>,
  setIsSaving: (saving: boolean) => void,
  setShowDeleteDialog: (show: boolean) => void
) => {
  if (!currentSite) return

  try {
    setIsSaving(true)
    await deleteSite(currentSite.id)
    
    // Cerrar el dialog inmediatamente para evitar efectos secundarios
    setShowDeleteDialog(false)
    
    // Navegar a la página principal después de la eliminación exitosa
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    }
    
    toast.success("Site deleted successfully")
  } catch (error) {
    console.error("Error deleting site:", error)
    
    // Improved error handling with more specific messages
    let errorMessage = "Error deleting site"
    
    if (error instanceof Error) {
      if (error.message.includes("Permission denied")) {
        errorMessage = "You don't have permission to delete this site"
      } else if (error.message.includes("Authentication required")) {
        errorMessage = "Please log in to delete this site"
      } else if (error.message.includes("Site not found")) {
        errorMessage = "Site not found or already deleted"
      } else if (error.message.includes("delete_site_safely")) {
        errorMessage = "Database function error. Please contact support."
      } else {
        errorMessage = error.message
      }
    }
    
    toast.error(errorMessage)
    setIsSaving(false)
    setShowDeleteDialog(false)
  }
}

