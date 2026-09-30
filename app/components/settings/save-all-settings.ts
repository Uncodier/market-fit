import { saveEmailCredentials } from "./save-email-credentials"
import { mergeActivitySettings, validatedActivityUpdates } from "./activity-settings"
import { validateActivitiesForSave } from "./outreach-save-validation"
import { toast } from "sonner"
import { type SiteFormValues } from "./form-schema"
import { type Site } from "../../context/SiteContext"
import { createClient } from "@/lib/supabase/client"
import { copywritingService } from "../../context/copywriting-actions"

import { type SaveOptions, shouldPreventRefresh } from "./save-settings-shared"

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
    const validatedActivities = await validateActivitiesForSave(mergeActivitySettings(currentSite.settings?.activities, data.activities), currentSite.settings?.channels, currentSite.id, currentSite.settings?.business_hours);
    const activities = validatedActivityUpdates(validatedActivities, data.activities);
    
    // Create settingsData object explicitly without any tracking fields
    const settingsData = {
      about, company_size, industry, products, services, locations,
      business_hours, goals: rawGoals, swot: rawSwot, marketing_budget, marketing_channels,
      social_media, company, customer_journey, copywriting, activities,
      shop: data.shop || currentSite.settings?.shop
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
          show_cookie_consent: tracking?.show_cookie_consent ?? channels?.website?.show_cookie_consent ?? currentSite.settings?.channels?.website?.show_cookie_consent ?? false,
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
      activities: settingsData.activities
    };
    
    await saveEmailCredentials(data, currentSite, settings)

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
          ...settingsData,
          shop: {
            ...currentSite.settings?.shop,
            ...settingsData.shop
          },
          // Preserve nested objects that might get overwritten
          channels: {
            ...currentSite.settings?.channels,
            ...settingsData.channels,
            // Deep merge for email, whatsapp, and website to preserve all fields
            email: {
              ...currentSite.settings?.channels?.email,
              ...settingsData.channels?.email
            },
            whatsapp: {
              ...currentSite.settings?.channels?.whatsapp,
              ...settingsData.channels?.whatsapp
            },
            website: {
              ...currentSite.settings?.channels?.website,
              ...settingsData.channels?.website
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

