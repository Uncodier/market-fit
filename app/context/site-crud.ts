"use client"

import type { Site, SiteSettings } from "./site-types"

type CrudDeps = {
  supabase: any
  currentSite: Site | null
  sites: Site[]
  setCurrentSite: (site: Site) => void
  setSites: (updater: Site[] | ((prev: Site[]) => Site[])) => void
  setError: (error: Error | null) => void
  setIsLoading: (v: boolean) => void
  loadSites: () => Promise<void>
  updateSettings: (siteId: string, settings: Partial<SiteSettings>) => Promise<void>
  selectSite: (site: Site) => Promise<void>
  shouldPreventRefresh: () => boolean
  isOnProtectedPage: () => boolean
}

export async function updateSiteRecord(site: Site, deps: CrudDeps) {
  const { supabase, currentSite, setCurrentSite, setSites, setError, loadSites, updateSettings, shouldPreventRefresh, isOnProtectedPage } = deps

    // Prevent updating demo sites
    if (site.id.startsWith('demo-')) {
      console.log('Skipping site update for demo site');
      // Update local state to simulate save success
      setSites(prevSites => prevSites.map(s => s.id === site.id ? site : s));
      if (currentSite?.id === site.id) setCurrentSite(site);
      return;
    }

    try {
      // Don't set isLoading to avoid UI interruptions during save
      // setIsLoading(true);
      
      // Extract tracking data for clean update - preserve ALL fields
      const trackingData = site.tracking || {
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
      };
      
      // Update the site record
      const { data: updatedSiteData, error: updateError } = await supabase
        .from('sites')
        .update({
          name: site.name,
          url: site.url,
          description: site.description,
          logo_url: site.logo_url,
          resource_urls: site.resource_urls,
          tracking: trackingData,
          updated_at: new Date().toISOString()
        })
        .eq('id', site.id)
        .select()
      
      if (updateError) throw updateError;
      
      // If settings provided, update them as well
      if (site.settings) {
        await updateSettings(site.id, site.settings)
      }
      
      // Update local state without full reload when preventing refresh
      if (shouldPreventRefresh() || isOnProtectedPage()) {
        
        // Update the current site if it's the same site being updated
        if (currentSite && currentSite.id === site.id) {
          setCurrentSite(site);
        }
        
        // Update the sites array
        setSites(prevSites => 
          prevSites.map(s => s.id === site.id ? site : s)
        );
      } else {
        // Only reload sites if not preventing refresh
        await loadSites();
      }
      
    } catch (err) {
      console.error("Error updating site:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    } finally {
      // setIsLoading(false) // Not needed since we don't set it to true
    }
}

export async function createSiteRecord(newSite: Omit<Site, 'id' | 'created_at' | 'updated_at'>, deps: CrudDeps): Promise<Site> {
  const { supabase, currentSite, setSites, setError, setIsLoading, loadSites, updateSettings, selectSite } = deps

    try {
      setIsLoading(true);
      
      // Ensure user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("User not authenticated");
      
      // Crear el nuevo sitio en la base de datos
      const now = new Date().toISOString();
      const MAX_INLINE_LOGO_CHARS = 100_000
      const rawLogo = typeof newSite.logo_url === "string" ? newSite.logo_url : ""
      const logoUrl =
        !rawLogo
          ? null
          : rawLogo.startsWith("data:") && rawLogo.length > MAX_INLINE_LOGO_CHARS
            ? null
            : rawLogo

      const siteInsert = {
        name: newSite.name,
        url: newSite.url || null,
        description: newSite.description || null,
        logo_url: logoUrl,
        resource_urls: newSite.resource_urls || [],
        user_id: session.user.id,
        created_at: now,
        updated_at: now
      }

      let { data: createdSiteData, error: createError } = await supabase
        .from('sites')
        .insert(siteInsert)
        .select()

      if (createError && logoUrl) {
        console.warn("CREATE SITE: insert failed with logo, retrying without it:", createError)
        const retry = await supabase
          .from('sites')
          .insert({ ...siteInsert, logo_url: null })
          .select()
        createdSiteData = retry.data
        createError = retry.error
      }
      
      if (createError) {
        throw createError;
      }
      if (!createdSiteData || createdSiteData.length === 0) throw new Error("Could not create site");
      
      
      // Iniciar con un sitio vacío
      const createdSite = {
        ...createdSiteData[0],
        settings: {}
      } as Site;
      
      // Crear configuración inicial si el sitio se creó correctamente
      if (createdSite && createdSite.id) {
        // Usar los settings que se pasaron en newSite, o valores por defecto
        const settingsToSave: Partial<SiteSettings> = {
          site_id: createdSite.id,
          // Usar los settings pasados como parámetro, o valores por defecto
          ...(newSite.settings || {}),
          // Asegurar que siempre tenemos estos valores mínimos
          competitors: newSite.settings?.competitors || [],
          focus_mode: newSite.settings?.focus_mode || 50
        };
        
        try {
          await updateSettings(createdSite.id, settingsToSave);
          
          // Actualizar el objeto createdSite con los settings guardados
          createdSite.settings = settingsToSave as SiteSettings;
        } catch (settingsError) {
          console.error("CREATE SITE: Error creating initial settings:", settingsError);
          // Continue even if settings fail - the site was created successfully
        }

        // Sync office locations into SQL locations table (used by inventory/shipments/POS)
        try {
          const jsonLocations = Array.isArray(settingsToSave.locations)
            ? settingsToSave.locations
            : [];
          const namedLocations = jsonLocations.filter(
            (loc: any) => loc?.name && String(loc.name).trim()
          );

          if (namedLocations.length > 0) {
            for (let i = 0; i < namedLocations.length; i++) {
              const loc = namedLocations[i] as any;
              const { error: locError } = await supabase
                .from("locations")
                .upsert(
                  {
                    site_id: createdSite.id,
                    name: String(loc.name).trim(),
                    address: loc.address || null,
                    city: loc.city || null,
                    state: loc.state || null,
                    zip: loc.zip || null,
                    country: loc.country || null,
                    is_default: i === 0,
                    is_active: true,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "site_id,name" }
                );
              if (locError) {
                console.warn("CREATE SITE: location upsert warning:", locError);
              }
            }
          } else {
            await supabase.from("locations").insert({
              site_id: createdSite.id,
              name: "Main",
              is_default: true,
              is_active: true,
            });
          }

          // Seed default price list if missing
          const { data: existingPriceList } = await supabase
            .from("price_lists")
            .select("id")
            .eq("site_id", createdSite.id)
            .eq("is_default", true)
            .maybeSingle();
          if (!existingPriceList) {
            await supabase.from("price_lists").insert({
              site_id: createdSite.id,
              name: "Standard",
              is_default: true,
              is_active: true,
              channels: ["pos"],
            });
          }
        } catch (commerceSeedError) {
          console.warn(
            "CREATE SITE: Error seeding commerce defaults:",
            commerceSeedError
          );
        }
      }
      
      // 🔥 FIX: We must use loadSites() directly, not loadSitesWithPrevention()
      // because loadSitesWithPrevention() aborts if we are on '/create-site' 
      // leaving the sites array empty and causing a redirect loop back to create-site!
      // Also, we optimistically update the sites array so the UI has immediate access to the new site.
      setSites(prev => {
        if (prev.some(s => s.id === createdSite.id)) return prev;
        return [...prev, createdSite];
      });

      if (!currentSite) {
        void selectSite(createdSite).catch((err) => {
          console.error("CREATE SITE: Error selecting new site:", err);
        });
      }

      void loadSites().catch((err) => {
        console.error("CREATE SITE: Error refreshing sites:", err);
      });
      
      return createdSite
    } catch (err) {
      // Improved error logging to handle Supabase errors properly
      console.error("Error creating site:")
      console.error("Error type:", typeof err)
      console.error("Error message:", (err as any)?.message || 'No message')
      console.error("Error code:", (err as any)?.code || 'No code')
      console.error("Error details:", (err as any)?.details || 'No details')
      console.error("Full error object:", JSON.stringify(err, null, 2))
      console.error("Error stack:", (err as any)?.stack || 'No stack')
      
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    } finally {
      setIsLoading(false);
    }
}

export async function deleteSiteRecord(id: string, deps: CrudDeps) {
  const { supabase, currentSite, sites, setSites, setError, loadSites, selectSite } = deps

    // Prevent deleting demo sites
    if (id.startsWith('demo-')) {
      console.log('Skipping delete for demo site');
      setSites(prevSites => prevSites.filter(s => s.id !== id));
      if (currentSite?.id === id && sites.length > 0) {
        const newCurrentSite = sites.find(site => site.id !== id && !site.id.startsWith('demo-')) || sites[0];
        if (newCurrentSite) selectSite(newCurrentSite).catch(err => {
          console.error("Error setting new current site after delete demo:", err);
        });
      }
      return;
    }

    if (!supabase) return Promise.reject(new Error("Supabase client not initialized"))
    
    try {
      setError(null)
      
      // Usar la función SQL segura en lugar del DELETE directo
      const { error } = await supabase.rpc('delete_site_safely', {
        site_id_param: id
      })
      
      if (error) throw error
      
      await loadSites() // Recargar los sitios
      
      // Si el sitio eliminado es el actual, cambiamos a otro
      if (currentSite?.id === id && sites.length > 0) {
        const newCurrentSite = sites.find(site => site.id !== id)
        if (newCurrentSite) selectSite(newCurrentSite).catch(err => {
          console.error("Error setting new current site after delete:", err);
        });
      }
    } catch (err) {
      console.error("Error deleting site:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    }
}

