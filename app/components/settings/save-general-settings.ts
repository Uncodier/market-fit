import { toast } from "sonner"
import { type SiteFormValues } from "./form-schema"

import { type SaveOptions, saveSiteWithSettings, shouldPreventRefresh } from "./save-settings-shared"

// Partial save handler for General section (Site Information)
export const handleSaveGeneral = async (data: SiteFormValues, options: SaveOptions) => {
  const { currentSite, refreshSites, setIsSaving } = options

  if (!currentSite) return

  try {
    setIsSaving(true)

    // Validate required fields
    if (!data.name?.trim()) {
      toast.error("Site name is required")
      setIsSaving(false)
      return
    }

    if (!data.url?.trim()) {
      toast.error("Site URL is required")
      setIsSaving(false)
      return
    }

    if (data.url && !data.url.match(/^https?:\/\/.+/)) {
      toast.error("Site URL must be a valid URL starting with http:// or https://")
      setIsSaving(false)
      return
    }

    const {
      name,
      url,
      description,
      logo_url,
      resource_urls,
      competitors,
      focusMode,
      tracking,
      default_locale,
    } = data

    // Save focusMode to localStorage
    if (typeof focusMode === 'number') {
      try {
        localStorage.setItem(`site_${currentSite.id}_focus_mode`, String(focusMode))
      } catch (e) {
        console.error("Error saving focus_mode to localStorage:", e)
      }
    }

    // Filter out empty URLs
    const filteredResourceUrls = resource_urls?.filter((url: any) => url.key && url.url && url.key.trim() !== '' && url.url.trim() !== '') || []
    const filteredCompetitors = competitors?.filter((comp: any) => comp.url && comp.url.trim() !== '') || []

    // Update site basic info
    const siteUpdate = {
      name,
      url,
      description: description || null,
      logo_url: logo_url || null,
      resource_urls: filteredResourceUrls,
      tracking: {
        track_visitors: Boolean(tracking?.track_visitors),
        track_actions: Boolean(tracking?.track_actions),
        record_screen: Boolean(tracking?.record_screen),
        privacy: {
          ...currentSite.tracking?.privacy,
          cookie_consent: Boolean(tracking?.show_cookie_consent)
        },
        enable_chat: Boolean(tracking?.enable_chat),
        chat_accent_color: tracking?.chat_accent_color || "#e0ff17",
        allow_anonymous_messages: Boolean(tracking?.allow_anonymous_messages),
        chat_position: tracking?.chat_position || "bottom-right",
        welcome_message: tracking?.welcome_message || "Welcome to our website! How can we assist you today?",
        chat_title: tracking?.chat_title || "Chat with us",
        analytics_provider: tracking?.analytics_provider || "",
        analytics_id: tracking?.analytics_id || "",
        tracking_code: tracking?.tracking_code || ""
      }
    }

    // Update settings with competitors, focus_mode, and default site language
    const settingsUpdate: any = {
      site_id: currentSite.id,
      competitors: filteredCompetitors?.length > 0 ? filteredCompetitors : [],
      focus_mode: focusMode || 50,
      default_locale: default_locale || "en",
    }

    // Preserve existing settings ID if it exists
    if (currentSite.settings?.id) {
      settingsUpdate.id = currentSite.settings.id
    }

    await saveSiteWithSettings({
      ...currentSite,
      ...siteUpdate
    } as any, settingsUpdate, options)

    if (!shouldPreventRefresh()) {
      await refreshSites()
    }

    toast.success("Site information saved successfully")
  } catch (error) {
    console.error("Error saving general settings:", error)
    if (error instanceof Error) {
      toast.error(`Error: ${error.message}`)
    } else {
      toast.error("Error saving site information")
    }
  } finally {
    setIsSaving(false)
  }
}

// Partial save handler for Company section
export const handleSaveShop = async (data: SiteFormValues, options: SaveOptions) => {
  const { currentSite, updateSettings, refreshSites, setIsSaving } = options

  if (!currentSite) return

  try {
    setIsSaving(true)

    const shop = data.shop || {
      hero_title: "",
      hero_subtitle: "",
      hero_cta_label: "Shop Now",
      hero_cta_destination_type: "scroll",
      hero_cta_destination_value: "",
      hero_order_bar: false,
      hero_image_url: "",
      shipping_cost: null,
      free_shipping_threshold: null,
      delivery_time_min: null,
      delivery_time_max: null,
      return_policy_summary: "30-Day Returns",
      trust_badges: [],
      payment_methods: ['card', 'cash_on_pickup'],
      default_delivery_options: ['pickup', 'ship', 'dine_in'],
      bank_transfer: {}
    }

    const settingsUpdate: any = {
      site_id: currentSite.id,
      shop
    }

    if (currentSite.settings?.id) {
      settingsUpdate.id = currentSite.settings.id
    }

    await updateSettings(currentSite.id, settingsUpdate)

    if (!shouldPreventRefresh()) {
      await refreshSites()
    }

    toast.success("Marketplace settings saved successfully")
  } catch (error) {
    console.error("Error saving marketplace settings:", error)
    if (error instanceof Error) {
      toast.error(`Error: ${error.message}`)
    } else {
      toast.error("Error saving marketplace settings")
    }
  } finally {
    setIsSaving(false)
  }
}

export const handleSavePrinters = async (data: SiteFormValues, options: SaveOptions) => {
  const { currentSite, updateSettings, refreshSites, setIsSaving } = options
  if (!currentSite) return

  try {
    setIsSaving(true)
    const printers = data.printers || { devices: [] }
    const settingsUpdate: any = {
      site_id: currentSite.id,
      printers,
    }
    if (currentSite.settings?.id) {
      settingsUpdate.id = currentSite.settings.id
    }
    await updateSettings(currentSite.id, settingsUpdate)
    if (!shouldPreventRefresh()) {
      await refreshSites()
    }
    toast.success("Printer settings saved")
  } catch (error) {
    console.error("Error saving printer settings:", error)
    toast.error(error instanceof Error ? error.message : "Error saving printer settings")
  } finally {
    setIsSaving(false)
  }
}

export const handleSaveCompany = async (data: SiteFormValues, options: SaveOptions) => {
  const { currentSite, updateSettings, refreshSites, setIsSaving, t } = options

  if (!currentSite) return

  try {
    setIsSaving(true)

    const { about, company_size, industry, products, services, locations, business_hours, goals: rawGoals, swot: rawSwot, currency } = data

    // Ensure SWOT and goals have the correct structure
    const swot = {
      strengths: rawSwot?.strengths || "",
      weaknesses: rawSwot?.weaknesses || "",
      opportunities: rawSwot?.opportunities || "",
      threats: rawSwot?.threats || ""
    }

    const goals = {
      quarterly: rawGoals?.quarterly || "",
      yearly: rawGoals?.yearly || "",
      fiveYear: rawGoals?.fiveYear || "",
      tenYear: rawGoals?.tenYear || ""
    }

    const settingsUpdate: any = {
      site_id: currentSite.id,
      about: about || "",
      company_size: company_size || "",
      industry: industry || "",
      currency: currency || "USD",
      products: Array.isArray(products) ? products : [],
      services: Array.isArray(services) ? services : [],
      swot,
      locations: locations || [],
      business_hours: business_hours || [],
      goals
    }

    // Preserve existing settings ID if it exists
    if (currentSite.settings?.id) {
      settingsUpdate.id = currentSite.settings.id
    }

    await updateSettings(currentSite.id, settingsUpdate)

    if (!shouldPreventRefresh()) {
      await refreshSites()
    }

    toast.success(t?.("settings.company.toast.saved") || "Company information saved successfully")
  } catch (error) {
    console.error("Error saving company settings:", error)
    if (error instanceof Error) {
      toast.error(`Error: ${error.message}`)
    } else {
      toast.error(t?.("settings.company.toast.error") || "Error saving company information")
    }
  } finally {
    setIsSaving(false)
  }
}

