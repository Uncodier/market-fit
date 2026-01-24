import { toast } from "sonner"
import { type SiteFormValues } from "./form-schema"
import { type Site } from "../../context/SiteContext"
import { secureTokensService } from "../../services/secure-tokens-service"
import { createClient } from "@/lib/supabase/client"
import { copywritingService } from "../../context/copywriting-actions"

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
      social_media, company, customer_journey, copywriting
    } = data;
    const activities = (data as any).activities;
    
    // Create settingsData object explicitly without any tracking fields
    const settingsData = {
      about, company_size, industry, products, services, locations,
      business_hours, goals: rawGoals, swot: rawSwot, marketing_budget, marketing_channels,
      social_media, company, customer_journey, copywriting, activities
    };
    
    console.log("SAVE 3: Datos extraídos del formulario:", {
      site: { name, url, description },
      settings: { goals: rawGoals, about: settingsData.about },
      branding: data.branding,
      customer_journey: customer_journey
    });
    
    // Debug specific branding data
    console.log("SAVE 3.1: Branding data details:", {
      brand_essence: data.branding?.brand_essence,
      personality_traits: data.branding?.personality_traits,
      primary_color: data.branding?.primary_color,
      communication_style: data.branding?.communication_style
    });
    
    // Debug specific customer journey data
    console.log("SAVE 3.2: Customer journey data details:", {
      awareness: customer_journey?.awareness,
      consideration: customer_journey?.consideration,
      decision: customer_journey?.decision
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
      // Include channels configuration - preserve existing configuration and merge with new data
      channels: {
        email: {
          enabled: channels?.email?.enabled ?? currentSite.settings?.channels?.email?.enabled ?? false,
          email: channels?.email?.email ?? currentSite.settings?.channels?.email?.email ?? "",
          password: channels?.email?.password ?? currentSite.settings?.channels?.email?.password ?? "",
          aliases: channels?.email?.aliases ?? currentSite.settings?.channels?.email?.aliases ?? "",
          incomingServer: channels?.email?.incomingServer ?? currentSite.settings?.channels?.email?.incomingServer ?? "",
          incomingPort: channels?.email?.incomingPort ?? currentSite.settings?.channels?.email?.incomingPort ?? "",
          outgoingServer: channels?.email?.outgoingServer ?? currentSite.settings?.channels?.email?.outgoingServer ?? "",
          outgoingPort: channels?.email?.outgoingPort ?? currentSite.settings?.channels?.email?.outgoingPort ?? "",
          status: (channels?.email?.status ?? currentSite.settings?.channels?.email?.status ?? "not_configured") as "not_configured" | "password_required" | "pending_sync" | "synced"
        },
        whatsapp: {
          enabled: channels?.whatsapp?.enabled ?? currentSite.settings?.channels?.whatsapp?.enabled ?? false,
          setupType: channels?.whatsapp?.setupType ?? currentSite.settings?.channels?.whatsapp?.setupType ?? undefined,
          country: channels?.whatsapp?.country ?? currentSite.settings?.channels?.whatsapp?.country ?? undefined,
          region: channels?.whatsapp?.region ?? currentSite.settings?.channels?.whatsapp?.region ?? undefined,
          account_sid: channels?.whatsapp?.account_sid ?? currentSite.settings?.channels?.whatsapp?.account_sid ?? undefined,
          existingNumber: channels?.whatsapp?.existingNumber ?? currentSite.settings?.channels?.whatsapp?.existingNumber ?? undefined,
          setupRequested: channels?.whatsapp?.setupRequested ?? currentSite.settings?.channels?.whatsapp?.setupRequested ?? false,
          status: (channels?.whatsapp?.status ?? currentSite.settings?.channels?.whatsapp?.status ?? "not_configured") as "not_configured" | "pending" | "active"
        },
        website: {
          enabled: (tracking?.track_visitors || tracking?.track_actions || tracking?.record_screen || tracking?.enable_chat) ?? channels?.website?.enabled ?? currentSite.settings?.channels?.website?.enabled ?? false,
          track_visitors: tracking?.track_visitors ?? channels?.website?.track_visitors ?? currentSite.settings?.channels?.website?.track_visitors ?? false,
          track_actions: tracking?.track_actions ?? channels?.website?.track_actions ?? currentSite.settings?.channels?.website?.track_actions ?? false,
          record_screen: tracking?.record_screen ?? channels?.website?.record_screen ?? currentSite.settings?.channels?.website?.record_screen ?? false,
          enable_chat: tracking?.enable_chat ?? channels?.website?.enable_chat ?? currentSite.settings?.channels?.website?.enable_chat ?? false,
          chat_accent_color: tracking?.chat_accent_color ?? channels?.website?.chat_accent_color ?? currentSite.settings?.channels?.website?.chat_accent_color ?? "#e0ff17",
          allow_anonymous_messages: tracking?.allow_anonymous_messages ?? channels?.website?.allow_anonymous_messages ?? currentSite.settings?.channels?.website?.allow_anonymous_messages ?? false,
          chat_position: tracking?.chat_position ?? channels?.website?.chat_position ?? currentSite.settings?.channels?.website?.chat_position ?? "bottom-right",
          welcome_message: tracking?.welcome_message ?? channels?.website?.welcome_message ?? currentSite.settings?.channels?.website?.welcome_message ?? "Welcome to our website! How can we assist you today?",
          chat_title: tracking?.chat_title ?? channels?.website?.chat_title ?? currentSite.settings?.channels?.website?.chat_title ?? "Chat with us",
          analytics_provider: tracking?.analytics_provider ?? channels?.website?.analytics_provider ?? currentSite.settings?.channels?.website?.analytics_provider ?? "",
          analytics_id: tracking?.analytics_id ?? channels?.website?.analytics_id ?? currentSite.settings?.channels?.website?.analytics_id ?? "",
          tracking_code: tracking?.tracking_code ?? channels?.website?.tracking_code ?? currentSite.settings?.channels?.website?.tracking_code ?? ""
        }
      },
      // Incluir competitors y focus_mode en settings en lugar de site
      competitors: filteredCompetitors?.length > 0 ? filteredCompetitors : [],
      focus_mode: focusMode || 50,
      business_model: (() => {
        const businessModelData = {
          b2b: data.businessModel?.b2b || false,
          b2c: data.businessModel?.b2c || false,
          b2b2c: data.businessModel?.b2b2c || false
        };
        console.log("SAVE HANDLER: data.businessModel:", data.businessModel);
        console.log("SAVE HANDLER: Final business_model to save:", businessModelData);
        return businessModelData;
      })(),
      goals: {
        quarterly: goals.quarterly || "",
        yearly: goals.yearly || "", 
        fiveYear: goals.fiveYear || "",
        tenYear: goals.tenYear || ""
      }, // Use the validated goals object with correct field names
      branding: data.branding || {
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
      },
      customer_journey: customer_journey || {
        awareness: { metrics: [], actions: [], tactics: [] },
        consideration: { metrics: [], actions: [], tactics: [] },
        decision: { metrics: [], actions: [], tactics: [] },
        purchase: { metrics: [], actions: [], tactics: [] },
        retention: { metrics: [], actions: [], tactics: [] },
        referral: { metrics: [], actions: [], tactics: [] }
      },
      activities: (() => {
        const a = (settingsData.activities || {}) as any;
        const coerce = (v: any) => (v === 'inactive' ? 'inactive' : 'default');
        // For special activities, treat "default" as "active" since they only support "active" or "inactive"
        const coerceAssign = (v: any) => {
          if (v === 'active' || v === 'default') return 'active';
          return 'inactive';
        };
        return {
          daily_resume_and_stand_up: { status: coerce(a?.daily_resume_and_stand_up?.status ?? a?.daily_resume_and_stand_up) },
          local_lead_generation: { status: coerce(a?.local_lead_generation?.status ?? a?.local_lead_generation) },
          icp_lead_generation: { status: coerce(a?.icp_lead_generation?.status ?? a?.icp_lead_generation) },
          leads_initial_cold_outreach: { status: coerce(a?.leads_initial_cold_outreach?.status ?? a?.leads_initial_cold_outreach) },
          leads_follow_up: { status: coerce(a?.leads_follow_up?.status ?? a?.leads_follow_up) },
          email_sync: { status: coerce(a?.email_sync?.status ?? a?.email_sync) },
          assign_leads_to_team: { status: coerceAssign(a?.assign_leads_to_team?.status ?? a?.assign_leads_to_team) },
          notify_team_on_inbound_conversations: { status: coerce(a?.notify_team_on_inbound_conversations?.status ?? a?.notify_team_on_inbound_conversations) },
          supervise_conversations: { status: coerceAssign(a?.supervise_conversations?.status ?? a?.supervise_conversations) },
        } as const
      })()
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
          // Ensure channels structure exists and preserve existing whatsapp configuration
          if (!settings.channels) {
            settings.channels = {
              email: {},
              whatsapp: {}
            } as any;
          }
          if (!settings.channels.whatsapp) {
            settings.channels.whatsapp = {
              enabled: false,
              setupType: undefined,
              country: undefined,
              region: undefined,
              account_sid: undefined,
              existingNumber: undefined,
              setupRequested: false,
              status: "not_configured" as const
            };
          }
          // Update only email configuration fields from the form data, preserving existing whatsapp
          settings.channels.email = {
            enabled: data.channels.email.enabled || false,
            email: data.channels.email.email || "",
            password: "PASSWORD_PRESENT", // Indicate password is stored securely
            aliases: data.channels.email.aliases || "",
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
        // If using the stored password, make sure we keep ALL email configuration fields and preserve whatsapp
        if (!settings.channels) {
          settings.channels = {
            email: {},
            whatsapp: {}
          } as any;
        }
        if (!settings.channels.whatsapp) {
          settings.channels.whatsapp = {
            enabled: false,
            setupType: undefined,
            country: undefined,
            region: undefined,
            account_sid: undefined,
            existingNumber: undefined,
            setupRequested: false,
            status: "not_configured" as const
          };
        }
        // Update only email configuration, preserving existing whatsapp
        settings.channels.email = {
          enabled: data.channels.email.enabled || false,
          email: data.channels.email.email || "",
          password: "PASSWORD_PRESENT", // Keep the indicator
          aliases: data.channels.email.aliases || "",
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

    // Handle copywriting data separately
    console.log("SAVE 12.1: Processing copywriting data...");
    console.log("SAVE 12.1.1: Copywriting data:", JSON.stringify(copywriting, null, 2));
    console.log("SAVE 12.1.2: Copywriting is array?", Array.isArray(copywriting));
    console.log("SAVE 12.1.3: Copywriting length:", copywriting?.length || 0);
    
    if (copywriting && Array.isArray(copywriting)) {
      try {
        const supabase = createClient()
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError) {
          console.error("SAVE ERROR: Error getting user:", userError);
          toast.error("Failed to authenticate user for copywriting sync");
          return;
        }
        
        if (user) {
          console.log("SAVE 12.1.4: User found:", user.id);
          console.log("SAVE 12.1.5: Site ID:", currentSite.id);
          console.log("SAVE 12.1.6: Copywriting items to sync:", copywriting.length);
          
          const result = await copywritingService.syncCopywritingItems(
            currentSite.id, 
            user.id, 
            copywriting
          )
          
          console.log("SAVE 12.1.7: Sync result:", result);
          
          if (result.success) {
            console.log("SAVE 12.2: Copywriting data synced successfully");
          } else {
            console.error("SAVE ERROR: Failed to sync copywriting data:", result.error);
            toast.error(`Failed to save copywriting data: ${result.error}`);
          }
        } else {
          console.error("SAVE ERROR: No user found for copywriting sync");
          toast.error("Please log in to save copywriting data");
        }
      } catch (copywritingError) {
        console.error("SAVE ERROR en copywriting sync:", copywritingError);
        if (copywritingError instanceof Error) {
          console.error("SAVE ERROR stack:", copywritingError.stack);
          toast.error(`Failed to save copywriting data: ${copywritingError.message}`);
        } else {
          toast.error("Failed to save copywriting data");
        }
      }
    } else {
      console.log("SAVE 12.1: No copywriting data to process or not an array");
    }

    // NOTE: team_members sync is now handled in TeamSection specifically
    
    console.log("SAVE 13: Todo el proceso completado con éxito");
    
    // Check if we should prevent refresh based on current flags
    const shouldPreventRefresh = () => {
      if (typeof window === 'undefined') return false
      const preventRefresh = sessionStorage.getItem('preventAutoRefresh')
      const justBecameVisible = sessionStorage.getItem('JUST_BECAME_VISIBLE')
      const justGainedFocus = sessionStorage.getItem('JUST_GAINED_FOCUS')
      
      return preventRefresh === 'true' || justBecameVisible === 'true' || justGainedFocus === 'true'
    }
    
    if (shouldPreventRefresh()) {
      console.log("SAVE 14: Settings saved successfully, skipping sites refresh to prevent reload");
      
      // Even though we skip full refresh, we need to update the currentSite state
      // to reflect the saved changes in the UI, preserving nested objects like channels
      const updatedSite = {
        ...currentSite,
        ...siteUpdate,
        settings: {
          ...currentSite.settings,
          ...settings,
          // Preserve nested objects that might get overwritten
          channels: {
            ...currentSite.settings?.channels,
            ...settings.channels,
            // Deep merge for email, whatsapp, and website to preserve all fields
            email: {
              ...currentSite.settings?.channels?.email,
              ...settings.channels?.email
            },
            whatsapp: {
              ...currentSite.settings?.channels?.whatsapp,
              ...settings.channels?.whatsapp
            },
            website: {
              ...currentSite.settings?.channels?.website,
              ...settings.channels?.website
            }
          }
        }
      };
      
      // Update the current site state locally without triggering a full reload
      console.log("SAVE 14.1: Updating current site state locally");
      updateSite(updatedSite as any);
    } else {
      console.log("SAVE 14: Settings saved successfully, refreshing sites data");
      await refreshSites();
    }
    
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

// Helper function to check if refresh should be prevented
const shouldPreventRefresh = () => {
  if (typeof window === 'undefined') return false
  const preventRefresh = sessionStorage.getItem('preventAutoRefresh')
  const justBecameVisible = sessionStorage.getItem('JUST_BECAME_VISIBLE')
  const justGainedFocus = sessionStorage.getItem('JUST_GAINED_FOCUS')
  
  return preventRefresh === 'true' || justBecameVisible === 'true' || justGainedFocus === 'true'
}

// Helper function to update site state locally without refresh
const updateSiteLocally = (currentSite: Site, siteUpdate: any, settingsUpdate: any, updateSite: (site: any) => Promise<void>) => {
  const updatedSite = {
    ...currentSite,
    ...siteUpdate,
    settings: {
      ...currentSite.settings,
      ...settingsUpdate,
      channels: {
        ...currentSite.settings?.channels,
        ...settingsUpdate.channels,
        email: {
          ...currentSite.settings?.channels?.email,
          ...settingsUpdate.channels?.email
        },
        whatsapp: {
          ...currentSite.settings?.channels?.whatsapp,
          ...settingsUpdate.channels?.whatsapp
        },
        website: {
          ...currentSite.settings?.channels?.website,
          ...settingsUpdate.channels?.website
        }
      }
    }
  }
  updateSite(updatedSite as any)
}

// Partial save handler for General section (Site Information)
export const handleSaveGeneral = async (data: SiteFormValues, options: SaveOptions) => {
  const { currentSite, updateSite, updateSettings, refreshSites, setIsSaving } = options

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

    const { name, url, description, logo_url, resource_urls, competitors, focusMode, tracking } = data

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

    // Update settings with competitors and focus_mode
    const settingsUpdate: any = {
      site_id: currentSite.id,
      competitors: filteredCompetitors?.length > 0 ? filteredCompetitors : [],
      focus_mode: focusMode || 50
    }

    // Preserve existing settings ID if it exists
    if (currentSite.settings?.id) {
      settingsUpdate.id = currentSite.settings.id
    }

    await updateSite({
      ...currentSite,
      ...siteUpdate
    } as any)

    await updateSettings(currentSite.id, settingsUpdate)

    if (shouldPreventRefresh()) {
      updateSiteLocally(currentSite, siteUpdate, settingsUpdate, updateSite)
    } else {
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
export const handleSaveCompany = async (data: SiteFormValues, options: SaveOptions) => {
  const { currentSite, updateSite, updateSettings, refreshSites, setIsSaving } = options

  if (!currentSite) return

  try {
    setIsSaving(true)

    const { about, company_size, industry, products, services, locations, business_hours, goals: rawGoals, swot: rawSwot } = data

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

    if (shouldPreventRefresh()) {
      updateSiteLocally(currentSite, {}, settingsUpdate, updateSite)
    } else {
      await refreshSites()
    }

    toast.success("Company information saved successfully")
  } catch (error) {
    console.error("Error saving company settings:", error)
    if (error instanceof Error) {
      toast.error(`Error: ${error.message}`)
    } else {
      toast.error("Error saving company information")
    }
  } finally {
    setIsSaving(false)
  }
}

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

// Partial save handler for Channels section
export const handleSaveChannels = async (data: SiteFormValues, options: SaveOptions) => {
  const { currentSite, updateSite, updateSettings, refreshSites, setIsSaving } = options

  if (!currentSite) return

  try {
    setIsSaving(true)

    const { channels, tracking } = data

    // Handle secure token storage if new values are provided
    if (currentSite.id && channels?.email?.password && 
        channels.email.password.trim() !== '' && 
        channels.email.password !== 'STORED_SECURELY') {
      try {
        const emailIdentifier = channels.email.email || 'default'
        await secureTokensService.storeToken(
          currentSite.id,
          'email',
          channels.email.password,
          emailIdentifier
        )
        channels.email.password = ""
      } catch (tokenError) {
        console.error("Error storing email credentials:", tokenError)
      }
    }

    const settingsUpdate: any = {
      site_id: currentSite.id,
      channels: {
        email: {
          enabled: channels?.email?.enabled ?? currentSite.settings?.channels?.email?.enabled ?? false,
          email: channels?.email?.email ?? currentSite.settings?.channels?.email?.email ?? "",
          password: channels?.email?.password === 'STORED_SECURELY' || channels?.email?.password === 'PASSWORD_PRESENT' 
            ? "PASSWORD_PRESENT" 
            : (channels?.email?.password ?? currentSite.settings?.channels?.email?.password ?? ""),
          aliases: channels?.email?.aliases ?? currentSite.settings?.channels?.email?.aliases ?? "",
          incomingServer: channels?.email?.incomingServer ?? currentSite.settings?.channels?.email?.incomingServer ?? "",
          incomingPort: channels?.email?.incomingPort ?? currentSite.settings?.channels?.email?.incomingPort ?? "",
          outgoingServer: channels?.email?.outgoingServer ?? currentSite.settings?.channels?.email?.outgoingServer ?? "",
          outgoingPort: channels?.email?.outgoingPort ?? currentSite.settings?.channels?.email?.outgoingPort ?? "",
          status: (channels?.email?.status ?? currentSite.settings?.channels?.email?.status ?? "not_configured") as "not_configured" | "password_required" | "pending_sync" | "synced"
        },
        whatsapp: {
          enabled: channels?.whatsapp?.enabled ?? currentSite.settings?.channels?.whatsapp?.enabled ?? false,
          setupType: channels?.whatsapp?.setupType ?? currentSite.settings?.channels?.whatsapp?.setupType ?? undefined,
          country: channels?.whatsapp?.country ?? currentSite.settings?.channels?.whatsapp?.country ?? undefined,
          region: channels?.whatsapp?.region ?? currentSite.settings?.channels?.whatsapp?.region ?? undefined,
          account_sid: channels?.whatsapp?.account_sid ?? currentSite.settings?.channels?.whatsapp?.account_sid ?? undefined,
          existingNumber: channels?.whatsapp?.existingNumber ?? currentSite.settings?.channels?.whatsapp?.existingNumber ?? undefined,
          setupRequested: channels?.whatsapp?.setupRequested ?? currentSite.settings?.channels?.whatsapp?.setupRequested ?? false,
          status: (channels?.whatsapp?.status ?? currentSite.settings?.channels?.whatsapp?.status ?? "not_configured") as "not_configured" | "pending" | "active"
        },
        agent_email: {
          domain: channels?.agent_email?.domain ?? currentSite.settings?.channels?.agent_email?.domain ?? undefined,
          customDomain: channels?.agent_email?.customDomain ?? currentSite.settings?.channels?.agent_email?.customDomain ?? undefined,
          username: channels?.agent_email?.username ?? currentSite.settings?.channels?.agent_email?.username ?? currentSite.settings?.channels?.agent_email?.data?.username ?? undefined,
          displayName: channels?.agent_email?.displayName ?? currentSite.settings?.channels?.agent_email?.displayName ?? currentSite.settings?.channels?.agent_email?.data?.displayName ?? undefined,
          setupRequested: channels?.agent_email?.setupRequested ?? currentSite.settings?.channels?.agent_email?.setupRequested ?? false,
          status: (channels?.agent_email?.status ?? currentSite.settings?.channels?.agent_email?.status ?? "not_configured") as "not_configured" | "pending" | "active" | "waiting_for_verification",
          // Preserve metadata fields directly in agent_email (matching API structure)
          domain_id: currentSite.settings?.channels?.agent_email?.domain_id ?? currentSite.settings?.channels?.agent_email?.data?.domain_id,
          dns_records: currentSite.settings?.channels?.agent_email?.dns_records ?? currentSite.settings?.channels?.agent_email?.data?.dns_records,
          domain_status: currentSite.settings?.channels?.agent_email?.domain_status ?? currentSite.settings?.channels?.agent_email?.data?.domain_status,
          error_message: currentSite.settings?.channels?.agent_email?.error_message ?? currentSite.settings?.channels?.agent_email?.data?.error_message,
          created_at: currentSite.settings?.channels?.agent_email?.created_at,
          // Also keep data for backward compatibility
          data: {
            domain: channels?.agent_email?.domain === "custom" ? channels?.agent_email?.customDomain : channels?.agent_email?.domain ?? currentSite.settings?.channels?.agent_email?.data?.domain,
            username: channels?.agent_email?.username ?? currentSite.settings?.channels?.agent_email?.username ?? currentSite.settings?.channels?.agent_email?.data?.username,
            displayName: channels?.agent_email?.displayName ?? currentSite.settings?.channels?.agent_email?.displayName ?? currentSite.settings?.channels?.agent_email?.data?.displayName,
            domain_id: currentSite.settings?.channels?.agent_email?.domain_id ?? currentSite.settings?.channels?.agent_email?.data?.domain_id,
            dns_records: currentSite.settings?.channels?.agent_email?.dns_records ?? currentSite.settings?.channels?.agent_email?.data?.dns_records,
            domain_status: currentSite.settings?.channels?.agent_email?.domain_status ?? currentSite.settings?.channels?.agent_email?.data?.domain_status,
            error_message: currentSite.settings?.channels?.agent_email?.error_message ?? currentSite.settings?.channels?.agent_email?.data?.error_message
          }
        },
        agent_whatsapp: {
          country: channels?.agent_whatsapp?.country ?? currentSite.settings?.channels?.agent_whatsapp?.country ?? undefined,
          region: channels?.agent_whatsapp?.region ?? currentSite.settings?.channels?.agent_whatsapp?.region ?? undefined,
          setupRequested: channels?.agent_whatsapp?.setupRequested ?? currentSite.settings?.channels?.agent_whatsapp?.setupRequested ?? false,
          status: (channels?.agent_whatsapp?.status ?? currentSite.settings?.channels?.agent_whatsapp?.status ?? "not_configured") as "not_configured" | "pending" | "active"
        },
        website: {
          enabled: (tracking?.track_visitors || tracking?.track_actions || tracking?.record_screen || tracking?.enable_chat) ?? channels?.website?.enabled ?? currentSite.settings?.channels?.website?.enabled ?? false,
          track_visitors: tracking?.track_visitors ?? channels?.website?.track_visitors ?? currentSite.settings?.channels?.website?.track_visitors ?? false,
          track_actions: tracking?.track_actions ?? channels?.website?.track_actions ?? currentSite.settings?.channels?.website?.track_actions ?? false,
          record_screen: tracking?.record_screen ?? channels?.website?.record_screen ?? currentSite.settings?.channels?.website?.record_screen ?? false,
          enable_chat: tracking?.enable_chat ?? channels?.website?.enable_chat ?? currentSite.settings?.channels?.website?.enable_chat ?? false,
          chat_accent_color: tracking?.chat_accent_color ?? channels?.website?.chat_accent_color ?? currentSite.settings?.channels?.website?.chat_accent_color ?? "#e0ff17",
          allow_anonymous_messages: tracking?.allow_anonymous_messages ?? channels?.website?.allow_anonymous_messages ?? currentSite.settings?.channels?.website?.allow_anonymous_messages ?? false,
          chat_position: tracking?.chat_position ?? channels?.website?.chat_position ?? currentSite.settings?.channels?.website?.chat_position ?? "bottom-right",
          welcome_message: tracking?.welcome_message ?? channels?.website?.welcome_message ?? currentSite.settings?.channels?.website?.welcome_message ?? "Welcome to our website! How can we assist you today?",
          chat_title: tracking?.chat_title ?? channels?.website?.chat_title ?? currentSite.settings?.channels?.website?.chat_title ?? "Chat with us",
          analytics_provider: tracking?.analytics_provider ?? channels?.website?.analytics_provider ?? currentSite.settings?.channels?.website?.analytics_provider ?? "",
          analytics_id: tracking?.analytics_id ?? channels?.website?.analytics_id ?? currentSite.settings?.channels?.website?.analytics_id ?? "",
          tracking_code: tracking?.tracking_code ?? channels?.website?.tracking_code ?? currentSite.settings?.channels?.website?.tracking_code ?? ""
        }
      }
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

    toast.success("Channels saved successfully")
  } catch (error) {
    console.error("Error saving channels:", error)
    if (error instanceof Error) {
      toast.error(`Error: ${error.message}`)
    } else {
      toast.error("Error saving channels")
    }
  } finally {
    setIsSaving(false)
  }
}

// Partial save handler for Activities section
export const handleSaveActivities = async (data: SiteFormValues, options: SaveOptions) => {
  const { currentSite, updateSite, updateSettings, refreshSites, setIsSaving } = options

  if (!currentSite) return

  try {
    setIsSaving(true)

    const activities = (data as any).activities
    const a = activities || {}
    const coerce = (v: any) => (v === 'inactive' ? 'inactive' : 'default')
    // For special activities, treat "default" as "active" since they only support "active" or "inactive"
    const coerceAssign = (v: any) => {
      if (v === 'active' || v === 'default') return 'active';
      return 'inactive';
    }

    const activitiesData = {
      daily_resume_and_stand_up: { status: coerce(a?.daily_resume_and_stand_up?.status ?? a?.daily_resume_and_stand_up) },
      local_lead_generation: { status: coerce(a?.local_lead_generation?.status ?? a?.local_lead_generation) },
      icp_lead_generation: { status: coerce(a?.icp_lead_generation?.status ?? a?.icp_lead_generation) },
      leads_initial_cold_outreach: { status: coerce(a?.leads_initial_cold_outreach?.status ?? a?.leads_initial_cold_outreach) },
      leads_follow_up: { status: coerce(a?.leads_follow_up?.status ?? a?.leads_follow_up) },
      email_sync: { status: coerce(a?.email_sync?.status ?? a?.email_sync) },
      assign_leads_to_team: { status: coerceAssign(a?.assign_leads_to_team?.status ?? a?.assign_leads_to_team) },
      notify_team_on_inbound_conversations: { status: coerce(a?.notify_team_on_inbound_conversations?.status ?? a?.notify_team_on_inbound_conversations) },
      supervise_conversations: { status: coerceAssign(a?.supervise_conversations?.status ?? a?.supervise_conversations) },
    } as const

    const settingsUpdate: any = {
      site_id: currentSite.id,
      activities: activitiesData
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

    toast.success("Activities saved successfully")
  } catch (error) {
    console.error("Error saving activities:", error)
    if (error instanceof Error) {
      toast.error(`Error: ${error.message}`)
    } else {
      toast.error("Error saving activities")
    }
  } finally {
    setIsSaving(false)
  }
}

// Partial save handler for Copywriting section - saves only to copywriting table
export const handleSaveCopywriting = async (data: SiteFormValues, options: SaveOptions) => {
  const { currentSite, setIsSaving } = options

  if (!currentSite) return

  try {
    setIsSaving(true)

    const { copywriting } = data

    console.log("COPYWRITING SAVE: Starting copywriting-only save")
    console.log("COPYWRITING SAVE: Copywriting data:", JSON.stringify(copywriting, null, 2))
    console.log("COPYWRITING SAVE: Copywriting is array?", Array.isArray(copywriting))
    console.log("COPYWRITING SAVE: Copywriting length:", copywriting?.length || 0)

    if (!copywriting || !Array.isArray(copywriting)) {
      console.log("COPYWRITING SAVE: No copywriting data to save")
      toast.success("Copywriting saved successfully")
      return
    }

    const supabase = createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError) {
      console.error("COPYWRITING SAVE: Error getting user:", userError)
      toast.error("Failed to authenticate user for copywriting save")
      return
    }

    if (!user) {
      console.error("COPYWRITING SAVE: No user found")
      toast.error("Please log in to save copywriting data")
      return
    }

    console.log("COPYWRITING SAVE: User found:", user.id)
    console.log("COPYWRITING SAVE: Site ID:", currentSite.id)
    console.log("COPYWRITING SAVE: Copywriting items to sync:", copywriting.length)

    const result = await copywritingService.syncCopywritingItems(
      currentSite.id,
      user.id,
      copywriting
    )

    console.log("COPYWRITING SAVE: Sync result:", result)

    if (result.success) {
      console.log("COPYWRITING SAVE: Copywriting data synced successfully")
      toast.success("Copywriting saved successfully")
    } else {
      console.error("COPYWRITING SAVE: Failed to sync copywriting data:", result.error)
      toast.error(`Failed to save copywriting data: ${result.error}`)
    }
  } catch (error) {
    console.error("COPYWRITING SAVE: Exception during save:", error)
    if (error instanceof Error) {
      console.error("COPYWRITING SAVE: Error stack:", error.stack)
      toast.error(`Failed to save copywriting data: ${error.message}`)
    } else {
      toast.error("Failed to save copywriting data")
    }
  } finally {
    setIsSaving(false)
  }
} 