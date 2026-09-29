import { toast } from "sonner"
import { type SiteFormValues } from "./form-schema"

import { type SaveOptions, shouldPreventRefresh, updateSiteLocally } from "./save-settings-shared"

// Partial save handler for Branding section
export const handleSaveBranding = async (data: SiteFormValues, options: SaveOptions) => {
  const { currentSite, updateSite, updateSettings, refreshSites, setIsSaving } = options

  if (!currentSite) return

  try {
    setIsSaving(true)

    const branding = data.branding || {
      brand_essence: "",
      brand_personality: "",
      brand_benefits: "",
      brand_attributes: "",
      brand_values: "",
      brand_promise: "",
      primary_color: "#000000",
      secondary_color: "#666666",
      accent_color: "#e0ff17",
      success_color: "#22c55e",
      warning_color: "#f59e0b",
      error_color: "#ef4444",
      background_color: "#ffffff",
      surface_color: "#f8fafc",
      primary_font: "",
      secondary_font: "",
      font_size_scale: "medium",
      communication_style: "friendly",
      personality_traits: [],
      forbidden_words: [],
      preferred_phrases: [],
      logo_variations: [],
      do_list: [],
      dont_list: [],
      emotions_to_evoke: [],
      brand_archetype: undefined
    }

    const settingsUpdate: any = {
      site_id: currentSite.id,
      branding
    }

    // Preserve existing settings ID if it exists
    if (currentSite.settings?.id) {
      settingsUpdate.id = currentSite.settings.id
    }

    await updateSettings(currentSite.id, settingsUpdate)

    if (shouldPreventRefresh()) {
      updateSiteLocally(currentSite, {}, settingsUpdate, updateSite)
    } else {
      await refreshSites()
    }

    toast.success("Branding saved successfully")
  } catch (error) {
    console.error("Error saving branding:", error)
    if (error instanceof Error) {
      toast.error(`Error: ${error.message}`)
    } else {
      toast.error("Error saving branding")
    }
  } finally {
    setIsSaving(false)
  }
}

// Partial save handler for Marketing section
export const handleSaveMarketing = async (data: SiteFormValues, options: SaveOptions) => {
  const { currentSite, updateSite, updateSettings, refreshSites, setIsSaving } = options

  if (!currentSite) return

  try {
    setIsSaving(true)

    const { 
      marketing_budget, 
      marketing_channels, 
      competitors, 
      products, 
      services, 
      resource_urls, 
      focusMode,
      businessModel
    } = data

    // Filter out empty URLs
    const filteredResourceUrls = resource_urls?.filter((url: any) => url.key && url.url && url.key.trim() !== '' && url.url.trim() !== '') || []
    const filteredCompetitors = competitors?.filter((comp: any) => comp.url && comp.url.trim() !== '') || []

    // Save focusMode to localStorage
    if (typeof focusMode === 'number') {
      try {
        localStorage.setItem(`site_${currentSite.id}_focus_mode`, String(focusMode))
      } catch (e) {
        console.error("Error saving focus_mode to localStorage:", e)
      }
    }

    // Update site with resource_urls
    const siteUpdate: any = {
      resource_urls: filteredResourceUrls
    }

    // Update settings with marketing-related fields
    const settingsUpdate: any = {
      site_id: currentSite.id,
      marketing_budget: {
        total: marketing_budget?.total || 0,
        available: marketing_budget?.available || 0
      },
      marketing_channels: marketing_channels || [],
      competitors: filteredCompetitors?.length > 0 ? filteredCompetitors : [],
      products: Array.isArray(products) ? products : [],
      services: Array.isArray(services) ? services : [],
      focus_mode: focusMode || 50,
      business_model: {
        b2b: businessModel?.b2b || false,
        b2c: businessModel?.b2c || false,
        b2b2c: businessModel?.b2b2c || false
      }
    }

    // Preserve existing settings ID if it exists
    if (currentSite.settings?.id) {
      settingsUpdate.id = currentSite.settings.id
    }

    // Update site if resource_urls changed
    if (filteredResourceUrls.length > 0 || (currentSite.resource_urls && currentSite.resource_urls.length > 0)) {
      await updateSite({
        ...currentSite,
        ...siteUpdate
      } as any)
    }

    await updateSettings(currentSite.id, settingsUpdate)

    if (shouldPreventRefresh()) {
      updateSiteLocally(currentSite, siteUpdate, settingsUpdate, updateSite)
    } else {
      await refreshSites()
    }

    toast.success("Marketing information saved successfully")
  } catch (error) {
    console.error("Error saving marketing settings:", error)
    if (error instanceof Error) {
      toast.error(`Error: ${error.message}`)
    } else {
      toast.error("Error saving marketing information")
    }
  } finally {
    setIsSaving(false)
  }
}

// Partial save handler for Customer Journey section
export const handleSaveCustomerJourney = async (data: SiteFormValues, options: SaveOptions) => {
  const { currentSite, updateSite, updateSettings, refreshSites, setIsSaving } = options

  if (!currentSite) return

  try {
    setIsSaving(true)

    const customer_journey = data.customer_journey || {
      awareness: { metrics: [], actions: [], tactics: [] },
      consideration: { metrics: [], actions: [], tactics: [] },
      decision: { metrics: [], actions: [], tactics: [] },
      purchase: { metrics: [], actions: [], tactics: [] },
      retention: { metrics: [], actions: [], tactics: [] },
      referral: { metrics: [], actions: [], tactics: [] }
    }

    const settingsUpdate: any = {
      site_id: currentSite.id,
      customer_journey
    }

    // Preserve existing settings ID if it exists
    if (currentSite.settings?.id) {
      settingsUpdate.id = currentSite.settings.id
    }

    await updateSettings(currentSite.id, settingsUpdate)

    if (shouldPreventRefresh()) {
      updateSiteLocally(currentSite, {}, settingsUpdate, updateSite)
    } else {
      await refreshSites()
    }

    toast.success("Customer journey saved successfully")
  } catch (error) {
    console.error("Error saving customer journey:", error)
    if (error instanceof Error) {
      toast.error(`Error: ${error.message}`)
    } else {
      toast.error("Error saving customer journey")
    }
  } finally {
    setIsSaving(false)
  }
}

// Partial save handler for Social section
export const handleSaveSocial = async (data: SiteFormValues, options: SaveOptions) => {
  const { currentSite, updateSite, updateSettings, refreshSites, setIsSaving } = options

  if (!currentSite) return

  try {
    setIsSaving(true)

    // Filter out social media entries without platform or that are not active
    // Keep entries that are either:
    // 1. Active (isActive === true or 1)
    // 2. Have a platform selected (for new entries waiting to be connected)
    const filteredSocialMedia = data.social_media?.filter((sm: any) => {
      if (!sm.platform || sm.platform.trim() === '') {
        return false
      }
      
      // Keep if active or if platform is selected (waiting for connection)
      const isActive = sm.isActive === true || sm.isActive === 1
      return isActive || !!sm.platform
    }) || []

    const settingsUpdate: any = {
      site_id: currentSite.id,
      social_media: filteredSocialMedia
    }

    // Preserve existing settings ID if it exists
    if (currentSite.settings?.id) {
      settingsUpdate.id = currentSite.settings.id
    }

    await updateSettings(currentSite.id, settingsUpdate)

    if (shouldPreventRefresh()) {
      updateSiteLocally(currentSite, {}, settingsUpdate, updateSite)
    } else {
      await refreshSites()
    }

    toast.success("Social media saved successfully")
  } catch (error) {
    console.error("Error saving social media:", error)
    if (error instanceof Error) {
      toast.error(`Error: ${error.message}`)
    } else {
      toast.error("Error saving social media")
    }
  } finally {
    setIsSaving(false)
  }
}

