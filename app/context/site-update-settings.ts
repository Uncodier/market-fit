"use client"

import type { Site, SiteSettings } from "./site-types"

type PersistArgs = {
  supabase: any
  siteId: string
  settings: Partial<SiteSettings>
  currentSite: Site | null
  setCurrentSite: (site: Site) => void
  setSites: (updater: (prev: Site[]) => Site[]) => void
  loadSites: () => Promise<void>
  setError: (error: Error) => void
  shouldPreventRefresh: () => boolean
  isOnProtectedPage: () => boolean
}

export async function persistSiteSettings({
  supabase,
  siteId,
  settings,
  currentSite,
  setCurrentSite,
  setSites,
  loadSites,
  setError,
  shouldPreventRefresh,
  isOnProtectedPage,
}: PersistArgs) {
    try {
      // Don't set isLoading to avoid UI interruptions during save
      // setIsLoading(true);
      const now = new Date().toISOString();
      
      
      // Ensure we have valid settings data
      const formattedSettings: Partial<SiteSettings> = {
        site_id: siteId,
        ...settings,
        updated_at: now
      };
      
      // Process JSON fields to make sure they are valid
      if (settings.products !== undefined) {
        formattedSettings.products = Array.isArray(settings.products) ? settings.products : [];
      }
      
      if (settings.services !== undefined) {
        formattedSettings.services = Array.isArray(settings.services) ? settings.services : [];
      }
      
      if (settings.swot !== undefined) {
        formattedSettings.swot = typeof settings.swot === 'object' ? settings.swot : {
          strengths: '',
          weaknesses: '',
          opportunities: '',
          threats: ''
        };
      }
      
      if (settings.locations !== undefined) {
        formattedSettings.locations = Array.isArray(settings.locations) ? settings.locations : [];
      }
      
      if (settings.marketing_budget !== undefined) {
        formattedSettings.marketing_budget = typeof settings.marketing_budget === 'object' ? settings.marketing_budget : {
          total: 0,
          available: 0
        };
      }
      
      if (settings.marketing_channels !== undefined) {
        formattedSettings.marketing_channels = Array.isArray(settings.marketing_channels) ? settings.marketing_channels : [];
      }
      
      if (settings.social_media !== undefined) {
        formattedSettings.social_media = Array.isArray(settings.social_media) ? settings.social_media : [];
      }
      
      if (settings.team_members !== undefined) {
        formattedSettings.team_members = Array.isArray(settings.team_members) ? settings.team_members : [];
      }
      
      if (settings.team_roles !== undefined) {
        formattedSettings.team_roles = Array.isArray(settings.team_roles) ? settings.team_roles : [];
      }
      
      if (settings.calendars !== undefined) {
        formattedSettings.calendars = Array.isArray(settings.calendars) ? settings.calendars : [];
      }
      
      // Nuevos campos migrados de site a settings
      if (settings.competitors !== undefined) {
        formattedSettings.competitors = Array.isArray(settings.competitors) ? settings.competitors : [];
      }
      
      if (settings.focus_mode !== undefined) {
        formattedSettings.focus_mode = typeof settings.focus_mode === 'number' ? settings.focus_mode : 50;
      }
      
      if (settings.shop !== undefined) {
        formattedSettings.shop = typeof settings.shop === 'object' ? settings.shop : null;
      }

      if (settings.printers !== undefined) {
        formattedSettings.printers = typeof settings.printers === 'object' ? settings.printers : { devices: [] };
      }
      
      // Handle channels field
      if (settings.channels !== undefined) {
        if (typeof settings.channels === 'object' && settings.channels !== null) {
          // Preserve existing channels and merge with new ones (spread first so agent_email etc. are kept)
          formattedSettings.channels = {
            ...settings.channels,
            email: settings.channels.email || {
              enabled: false,
              email: "",
              password: "",
              incomingServer: "",
              incomingPort: "",
              outgoingServer: "",
              outgoingPort: "",
              status: "not_configured"
            },
            whatsapp: settings.channels.whatsapp || {
              enabled: false,
              setupType: "new_number",
              country: "",
              region: "",
              existingNumber: "",
              setupRequested: false,
              apiToken: "",
              account_sid: "",
              messaging_service_sid: "",
              status: "not_configured"
            },
            website: settings.channels.website ?? {
              enabled: false,
              track_visitors: false,
              track_actions: false,
              record_screen: false,
              enable_chat: false,
              chat_accent_color: "#e0ff17",
              allow_anonymous_messages: false,
              chat_position: "bottom-right",
              welcome_message: "Welcome to our website! How can we assist you today?",
              chat_title: "Chat with us",
              analytics_provider: "",
              analytics_id: "",
              tracking_code: ""
            }
          };
        } else {
          formattedSettings.channels = {
            email: {
              enabled: false,
              email: "",
              password: "",
              incomingServer: "",
              incomingPort: "",
              outgoingServer: "",
              outgoingPort: "",
              status: "not_configured"
            },
            whatsapp: {
              enabled: false,
              setupType: "new_number",
              country: "",
              region: "",
              existingNumber: "",
              setupRequested: false,
              apiToken: "",
              account_sid: "",
              messaging_service_sid: "",
              status: "not_configured"
            },
            website: {
              enabled: false,
              track_visitors: false,
              track_actions: false,
              record_screen: false,
              enable_chat: false,
              chat_accent_color: "#e0ff17",
              allow_anonymous_messages: false,
              chat_position: "bottom-right",
              welcome_message: "Welcome to our website! How can we assist you today?",
              chat_title: "Chat with us",
              analytics_provider: "",
              analytics_id: "",
              tracking_code: ""
            }
          };
        }
      }
      
      // Handle goals field
      if (settings.goals !== undefined) {
        const goalsObj = settings.goals || {};
        
        // Esto puede necesitar convertirse a un formato específico para PostgreSQL (JSON)
        // Asegurarse de que ningún field sea undefined y convertir todo a string si es necesario
        const goalsForDB = {
          quarterly: typeof goalsObj.quarterly === 'string' ? goalsObj.quarterly : '',
          yearly: typeof goalsObj.yearly === 'string' ? goalsObj.yearly : '',
          fiveYear: typeof goalsObj.fiveYear === 'string' ? goalsObj.fiveYear : '',
          tenYear: typeof goalsObj.tenYear === 'string' ? goalsObj.tenYear : ''
        };
        
        // IMPORTANTE: Asegurarnos de que estos campos son válidos para PostgreSQL
        // Convertir explícitamente a JSON string para garantizar que se guarda correctamente
        // Esto previene problemas de serialización y hace que sea un JSON válido
        formattedSettings.goals = goalsForDB;
        
        // Supabase puede tener problemas al serializar objetos directamente
        // Así que lo convertimos explícitamente a string JSON y luego Supabase lo guardará correctamente
        // Esta estrategia es para debugging, no es necesaria normalmente
        try {
          // Guardar como string JSON explícitamente (solo para propósitos de debugging)
          // formattedSettings.goals_json_string = JSON.stringify(goalsForDB);
        } catch (goalsSerializeError) {
          console.error("Error al serializar goals:", goalsSerializeError);
        }
      }
      
      // Handle customer_journey field
      if (settings.customer_journey !== undefined) {
        formattedSettings.customer_journey = typeof settings.customer_journey === 'object' ? settings.customer_journey : {
          awareness: { metrics: [], actions: [], tactics: [] },
          consideration: { metrics: [], actions: [], tactics: [] },
          decision: { metrics: [], actions: [], tactics: [] },
          purchase: { metrics: [], actions: [], tactics: [] },
          retention: { metrics: [], actions: [], tactics: [] },
          referral: { metrics: [], actions: [], tactics: [] }
        };
      }

      // Handle branding field
      if (settings.branding !== undefined) {
        formattedSettings.branding = typeof settings.branding === 'object' ? settings.branding : {
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
        };
      }
      
      // Remove allowed_domains from settings as it belongs to a separate table
      // Since allowed_domains is no longer part of SiteSettings interface, we just use formattedSettings directly
      const settingsForDB = formattedSettings;
      
      // Prevent updating demo sites
      if (siteId.startsWith('demo-')) {
        console.log('Skipping settings update for demo site');
        return;
      }

      // Use upsert operation with site_id as the conflict resolution field
      // First get existing settings to preserve other fields
      try {
        const { data: existingSettings, error: fetchError } = await supabase
          .from('settings')
          .select('*')
          .eq('site_id', siteId)
          .single();
        
        // Merge with existing settings to preserve all fields
        // Deep merge channels to preserve all channel types (email, whatsapp, website)
        let mergedSettings;
        if (existingSettings) {
          // CRITICAL: Convert channels from array to object if needed
          // The DB default is [] but we need {} for the merge to work
          const existingChannels = (Array.isArray(existingSettings.channels) || !existingSettings.channels)
            ? {} 
            : existingSettings.channels;
          
          mergedSettings = {
            ...existingSettings,
            ...settingsForDB,  // Override with new values
            // Deep merge channels to ensure all channel types are preserved
            channels: settingsForDB.channels ? {
              ...existingChannels,
              ...settingsForDB.channels,
              // Ensure all channel types are preserved - use new value if provided, otherwise keep existing
              email: settingsForDB.channels.email ?? existingChannels?.email,
              whatsapp: settingsForDB.channels.whatsapp ?? existingChannels?.whatsapp,
              website: settingsForDB.channels.website ?? existingChannels?.website,
              // Deep merge agent_email to preserve data fields like dns_records
              agent_email: settingsForDB.channels.agent_email ? {
                ...existingChannels?.agent_email,
                ...settingsForDB.channels.agent_email,
                data: settingsForDB.channels.agent_email.data ? {
                  ...existingChannels?.agent_email?.data,
                  ...settingsForDB.channels.agent_email.data
                } : existingChannels?.agent_email?.data
              } : existingChannels?.agent_email,
              // Deep merge agent_whatsapp
              agent_whatsapp: settingsForDB.channels.agent_whatsapp ?? existingChannels?.agent_whatsapp
            } : (existingChannels || settingsForDB.channels)
          };
        } else {
          // No existing settings, use the new settings directly
          mergedSettings = settingsForDB;
        }
        
        
        
        const { error } = await supabase
          .from('settings')
          .upsert(mergedSettings, { 
            onConflict: 'site_id',
            ignoreDuplicates: false
          });
        
        if (error) {
          console.error("UPDATE SETTINGS ERROR en upsert:", error);
          console.error("UPDATE SETTINGS ERROR detalles:", error.code, error.message, error.details);
          throw error;
        }
        
        
        // Verificar que se guardaron correctamente los datos
        const { data: verifyData, error: verifyError } = await supabase
          .from('settings')
          .select('goals')
          .eq('site_id', siteId)
          .single();
          
        if (verifyError) {
          console.error("UPDATE SETTINGS: Error al verificar guardado:", verifyError);
        } else {
        }
      } catch (upsertError) {
        console.error("UPDATE SETTINGS ERROR excepción en upsert:", upsertError);
        throw upsertError;
      }
      
      
      // Update local state without full reload when preventing refresh
      if (shouldPreventRefresh() || isOnProtectedPage()) {
        
        // Update the current site if it matches the siteId being updated
        if (currentSite && currentSite.id === siteId) {
          const updatedSite = {
            ...currentSite,
            settings: {
              ...currentSite.settings,
              ...formattedSettings
            }
          } as Site;
          setCurrentSite(updatedSite);
        }
        
        // Update the sites array 
        setSites(prevSites => 
          prevSites.map(site => 
            site.id === siteId 
              ? {
                  ...site,
                  settings: {
                    ...site.settings,
                    ...formattedSettings
                  }
                } as Site
              : site
          )
        );
      } else {
        // Only reload sites if not preventing refresh
        await loadSites();
      }
      
      
    } catch (err) {
      console.error("UPDATE SETTINGS ERROR GENERAL:", err);
      console.error("UPDATE SETTINGS ERROR tipo:", typeof err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      // setIsLoading(false); // Not needed since we don't set it to true
    }
  }
