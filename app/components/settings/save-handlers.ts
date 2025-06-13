import { toast } from "sonner"
import { type SiteFormValues } from "./form-schema"
import { type Site } from "../../context/SiteContext"
import { secureTokensService } from "../../services/secure-tokens-service"

interface SaveOptions {
  currentSite: Site
  updateSite: (site: any) => Promise<void>
  updateSettings: (siteId: string, settings: any) => Promise<void>
  refreshSites: () => Promise<void>
  setIsSaving: (saving: boolean) => void
}

export const handleSave = async (data: SiteFormValues, options: SaveOptions) => {
  const { 
    currentSite, 
    updateSite, 
    updateSettings, 
    refreshSites, 
    setIsSaving
  } = options

  if (!currentSite) return;
  
  try {
    console.log("SAVE 1: Inicio del proceso de guardado");
    setIsSaving(true)
    
    // Validate required fields
    if (!data.name?.trim()) {
      toast.error("Site name is required");
      setIsSaving(false);
      return;
    }

    if (!data.url?.trim()) {
      toast.error("Site URL is required");
      setIsSaving(false);
      return;
    }
    
    console.log("SAVE 2: Validaciones básicas completadas");
    
    // Extract site-specific fields (exclude team_members from general save)
    const { 
      name, url, description, logo_url, resource_urls, 
      competitors, focusMode, billing, tracking, 
      team_members, channels,
      // Extract all the settings fields explicitly to avoid any tracking contamination
      about, company_size, industry, products, services, locations, 
      business_hours, goals: rawGoals, swot: rawSwot, marketing_budget, marketing_channels, 
      social_media, company
    } = data;
    
    // Create settingsData object explicitly without any tracking fields
    const settingsData = {
      about, company_size, industry, products, services, locations,
      business_hours, goals: rawGoals, swot: rawSwot, marketing_budget, marketing_channels,
      social_media, company
    };
    
    console.log("SAVE 3: Datos extraídos del formulario:", {
      site: { name, url, description },
      settings: { goals: rawGoals, about: settingsData.about }
    });
    
    // Guardar inmediatamente el focusMode en localStorage para asegurar que persista
    if (typeof focusMode === 'number') {
      try {
        localStorage.setItem(`site_${currentSite.id}_focus_mode`, String(focusMode));
      } catch (e) {
        console.error("Error saving focus_mode to localStorage:", e);
      }
    }
    
    // Filter out empty URLs
    const filteredResourceUrls = resource_urls?.filter((url: any) => url.key && url.url && url.key.trim() !== '' && url.url.trim() !== '') || [];
    const filteredCompetitors = competitors?.filter((comp: any) => comp.url && comp.url.trim() !== '') || [];
    
    console.log("SAVE 4: Datos filtrados");
    
    // Filter out social media entries with empty URLs or required fields based on platform
    const filteredSocialMedia = settingsData.social_media?.filter((sm: any) => {
      // If platform is empty, don't include it
      if (!sm.platform || sm.platform.trim() === '') {
        return false;
      }
      
      // Platform-specific validations
      switch (sm.platform) {
        case 'whatsapp':
          // WhatsApp requires phone number
          if (!sm.phone || sm.phone.trim() === '') {
            console.log(`Skipping WhatsApp entry due to missing phone number`);
            return false;
          }
          return true;
        
        case 'telegram':
          // Telegram requires either a handle or a URL
          if ((!sm.handle || sm.handle.trim() === '') && (!sm.url || sm.url.trim() === '')) {
            console.log(`Skipping Telegram entry due to missing handle or URL`);
            return false;
          }
          
          // Validate URL format if provided
          if (sm.url && sm.url.trim() !== '' && !sm.url.match(/^https?:\/\/.+/)) {
            console.log(`Skipping Telegram entry due to invalid URL: ${sm.url}`);
            return false;
          }
          return true;
          
        case 'discord':
          // Discord requires either an invite code or a URL
          if ((!sm.inviteCode || sm.inviteCode.trim() === '') && (!sm.url || sm.url.trim() === '')) {
            console.log(`Skipping Discord entry due to missing invite code or URL`);
            return false;
          }
          
          // Validate URL format if provided
          if (sm.url && sm.url.trim() !== '' && !sm.url.match(/^https?:\/\/.+/)) {
            console.log(`Skipping Discord entry due to invalid URL: ${sm.url}`);
            return false;
          }
          return true;
          
        default:
          // For standard platforms, URL is not required - we can just have a handle
          // But if URL is provided, validate its format
          if (sm.url && sm.url.trim() !== '') {
            const hasValidUrl = sm.url.match(/^https?:\/\/.+/);
            if (!hasValidUrl) {
              console.log(`Skipping social media entry with platform ${sm.platform} due to invalid URL format: "${sm.url}"`);
              return false;
            }
          }
          return true;
      }
    }) || [];
    
    // Ensure SWOT and goals have the correct structure
    const swot = {
      strengths: rawSwot?.strengths || "",
      weaknesses: rawSwot?.weaknesses || "",
      opportunities: rawSwot?.opportunities || "",
      threats: rawSwot?.threats || ""
    };
    
    console.log("SAVE 5: Goals data original:", rawGoals);
    
    const goals = {
      quarterly: rawGoals?.quarterly || "",
      yearly: rawGoals?.yearly || "",
      fiveYear: rawGoals?.fiveYear || "",
      tenYear: rawGoals?.tenYear || ""
    };
    
    console.log("SAVE 6: Goals data procesado:", goals);
    
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
    };
    
    console.log("SAVE 7: Site update preparado:", siteUpdate);
    
    // Create settings object with direct field access to prevent undefined values
    // NOTE: team_members is now excluded from general save - handled in TeamSection
    const settings = {
      site_id: currentSite.id, // Explicitly set the site_id to ensure it's always correct
      about: settingsData.about || "",
      company_size: settingsData.company_size || "",
      industry: settingsData.industry || "",
      products: Array.isArray(settingsData.products) ? settingsData.products : [],
      services: Array.isArray(settingsData.services) ? settingsData.services : [],
      swot, // Use the validated swot object
      locations: settingsData.locations || [],
      business_hours: settingsData.business_hours || [],
      marketing_budget: {
        total: settingsData.marketing_budget?.total || 0,
        available: settingsData.marketing_budget?.available || 0
      },
      marketing_channels: settingsData.marketing_channels || [],
      social_media: filteredSocialMedia,
      // Include channels configuration
      channels: channels || {
        email: {
          enabled: false,
          email: "",
          password: "",
          incomingServer: "",
          incomingPort: "",
          outgoingServer: "",
          outgoingPort: "",
          status: "not_configured" as const
        },
        whatsapp: {
          enabled: false,
          setupType: undefined,
          country: undefined,
          region: undefined,
          existingNumber: undefined,
          setupRequested: false,
          status: "not_configured" as const
        }
      },
      // Incluir competitors y focus_mode en settings en lugar de site
      competitors: filteredCompetitors?.length > 0 ? filteredCompetitors : [],
      focus_mode: focusMode || 50,
      goals: {
        quarterly: goals.quarterly || "",
        yearly: goals.yearly || "", 
        fiveYear: goals.fiveYear || "",
        tenYear: goals.tenYear || ""
      } // Use the validated goals object with correct field names
    };
    
    // Handle secure token storage if new values are provided
    if (currentSite.id) {
      console.log("SAVE SECURE: Processing secure tokens");
      
      // Check for email credentials - Don't process 'STORED_SECURELY' as it's just a placeholder
      if (data.channels?.email?.password && 
          data.channels.email.password.trim() !== '' && 
          data.channels.email.password !== 'STORED_SECURELY') {
        try {
          console.log("SAVE SECURE: Storing email credentials");
          const emailIdentifier = data.channels.email.email || 'default';
          await secureTokensService.storeToken(
            currentSite.id,
            'email',
            data.channels.email.password,
            emailIdentifier
          );
          // Clear the password from the form data to avoid storing in plaintext
          data.channels.email.password = "";
          // Ensure we keep email settings structure in settings with ALL fields
          if (!settings.channels) settings.channels = { 
            email: {} as any,
            whatsapp: {
              enabled: false,
              setupType: undefined,
              country: undefined,
              region: undefined,
              existingNumber: undefined,
              setupRequested: false,
              status: "not_configured" as const
            }
          };
          // Copy all email configuration fields from the form data
          settings.channels.email = {
            enabled: data.channels.email.enabled || false,
            email: data.channels.email.email || "",
            password: "PASSWORD_PRESENT", // Indicate password is stored securely
            incomingServer: data.channels.email.incomingServer || "",
            incomingPort: data.channels.email.incomingPort || "",
            outgoingServer: data.channels.email.outgoingServer || "",
            outgoingPort: data.channels.email.outgoingPort || "",
            status: (data.channels.email.status || "not_configured") as "not_configured" | "password_required" | "pending_sync" | "synced"
          };
        } catch (tokenError) {
          console.error("Error storing email credentials:", tokenError);
        }
      } else if (data.channels?.email?.password === 'STORED_SECURELY' && data.channels.email.enabled) {
        // If using the stored password, make sure we keep ALL email configuration fields
        if (!settings.channels) settings.channels = { 
          email: {} as any,
          whatsapp: {
            enabled: false,
            setupType: undefined,
            country: undefined,
            region: undefined,
            existingNumber: undefined,
            setupRequested: false,
            status: "not_configured" as const
          }
        };
        settings.channels.email = {
          enabled: data.channels.email.enabled || false,
          email: data.channels.email.email || "",
          password: "PASSWORD_PRESENT", // Keep the indicator
          incomingServer: data.channels.email.incomingServer || "",
          incomingPort: data.channels.email.incomingPort || "",
          outgoingServer: data.channels.email.outgoingServer || "",
          outgoingPort: data.channels.email.outgoingPort || "",
          status: (data.channels.email.status || "not_configured") as "not_configured" | "password_required" | "pending_sync" | "synced"
        };
        // Clear the placeholder from data
        data.channels.email.password = "";
      }
    }
    
    // Preserve existing settings ID if it exists
    if (currentSite.settings?.id) {
      (settings as any).id = currentSite.settings.id;
    }
    
    console.log("SAVE 8: Settings preparado:", {
      id: (settings as any).id,
      site_id: settings.site_id,
      goals: settings.goals
    });
    
    // First update the site
    console.log("SAVE 9: Llamando a updateSite...");
    try {
      await updateSite({
        ...currentSite,
        ...siteUpdate
      } as any);
      console.log("SAVE 10: updateSite completado con éxito");
    } catch (siteError) {
      console.error("SAVE ERROR en updateSite:", siteError);
      throw siteError;
    }
    
    // Then update the settings
    console.log("SAVE 11: Llamando a updateSettings...");
    try {
      await updateSettings(currentSite.id, settings as any);
      console.log("SAVE 12: updateSettings completado con éxito");
    } catch (settingsError) {
      console.error("SAVE ERROR en updateSettings:", settingsError);
      throw settingsError;
    }

    // NOTE: team_members sync is now handled in TeamSection specifically
    
    console.log("SAVE 13: Todo el proceso completado con éxito");
    
    // Refresh site data to get updated values
    console.log("SAVE 14: Refreshing sites data...");
    await refreshSites();
    console.log("SAVE 15: Sites data refreshed successfully");
    
    toast.success("Settings saved successfully");
  } catch (error) {
    console.error("SAVE ERROR GENERAL:", error);
    
    // Show more specific error message if available
    if (error instanceof Error) {
      toast.error(`Error: ${error.message}`);
    } else {
      toast.error("Error saving settings");
    }
  } finally {
    // Always reset saving state
    setIsSaving(false);
  }
}

export const handleCacheAndRebuild = async (setIsSaving: (saving: boolean) => void) => {
  try {
    setIsSaving(true)
    // Aquí iría la lógica para borrar caché y reconstruir experimentos
    toast.success("Cache cleared and experiments rebuilt successfully")
  } catch (error) {
    console.error(error)
    toast.error("Error clearing cache and rebuilding experiments")
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
    console.error(error)
    toast.error("Error deleting site")
    setIsSaving(false)
    setShowDeleteDialog(false)
  }
} 