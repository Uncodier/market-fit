"use client"

import type { Site } from "./site-types"
import { setLocalStorage } from "./site-storage"

export function parseJsonField(field: any, defaultValue: any) {
  if (!field) return defaultValue
  try {
    if (typeof field === "object") return field
    if (typeof field === "string") {
      const parsed = JSON.parse(field)
      if (defaultValue && defaultValue.quarterly !== undefined) {
        return {
          quarterly: typeof parsed.quarterly === "string" ? parsed.quarterly : "",
          yearly: typeof parsed.yearly === "string" ? parsed.yearly : "",
          fiveYear: typeof parsed.fiveYear === "string" ? parsed.fiveYear : "",
          tenYear: typeof parsed.tenYear === "string" ? parsed.tenYear : "",
        }
      }
      return parsed
    }
    return defaultValue
  } catch (error) {
    console.error("Error parsing JSON field:", error, "Raw value:", field)
    return defaultValue
  }
}

type SetCurrentArgs = {
  site: Site
  currentSite: Site | null
  supabase: any
  setCurrentSite: (site: Site | ((current: Site | null) => Site | null)) => void
  setSites: (updater: (prev: Site[]) => Site[]) => void
}

export async function applyCurrentSite({
  site,
  currentSite,
  supabase,
  setCurrentSite,
  setSites,
}: SetCurrentArgs) {
    
    // Skip if we're setting the same site (avoid unnecessary reloads on focus changes)
    if (currentSite && site && currentSite.id === site.id) {
      return;
    }
    
    // Solo guardar si es un sitio válido y no es el 'default'
    if (site && site.id) {
      // ACTUALIZACIÓN OPTIMISTA: Cambiar el UI inmediatamente sin bloquear
      setLocalStorage("currentSiteId", site.id)
      setCurrentSite(site)
      
      try {
        // Cargar los settings y detalles de sitio en background
        if (supabase) {

        let settingsData = null;
        let settingsError = null;
        let siteDetailData = null;
        
        if (site.id.startsWith('demo-')) {
          const { getDemoData } = await import('@/lib/demo-data/index');
          const demoData = getDemoData(site.id);
          if (demoData && demoData.settings) {
            settingsData = demoData.settings;
          }
        } else {
          const [settingsResult, siteDetailResult] = await Promise.all([
            !site.settings ? supabase
              .from('settings')
              .select('*')
              .eq('site_id', site.id)
              .single() : Promise.resolve({ data: site.settings, error: null }),
            
            // Si no tenemos la URL del logo original (es nula, pero el sitio no es demo)
            // cargamos los detalles pesados
            site.logo_url === undefined || site.logo_url === null ? supabase
              .from('sites')
              .select('logo_url, tracking, resource_urls')
              .eq('id', site.id)
              .single() : Promise.resolve({ data: null, error: null })
          ]);
            
          settingsData = settingsResult.data;
          settingsError = settingsResult.error;
          siteDetailData = siteDetailResult.data;
        }
          
          if (settingsError && settingsError.code !== 'PGRST116') {
            // PGRST116 significa que no se encontraron registros (es normal para un sitio nuevo)
            console.error(`Error loading settings for site ${site.id}:`, settingsError);
          }
          
          // Si tenemos detalles (logo_url, etc), actualizar el objeto site primero
          let mergedSite = site;
          if (siteDetailData) {
            mergedSite = {
              ...site,
              logo_url: siteDetailData.logo_url,
              tracking: siteDetailData.tracking,
              resource_urls: siteDetailData.resource_urls
            };
            
            // Actualizar también en la lista de sitios y el sitio actual
            setSites(prev => prev.map(s => s.id === site.id ? mergedSite : s));
            setCurrentSite(current => current?.id === mergedSite.id ? mergedSite : current);
          }
          
          // Si tenemos settings, los agregamos al sitio
          if (settingsData) {
            
            let parsedGoals = {
              quarterly: '',
              yearly: '',
              fiveYear: '',
              tenYear: ''
            };
            
                          try {
                parsedGoals = parseJsonField(settingsData.goals, {
                  quarterly: '',
                  yearly: '',
                  fiveYear: '',
                  tenYear: ''
                });
              } catch (goalsError) {
                console.error("Error parsing goals:", goalsError);
              }
            
            // Parse business_hours specifically
            const parsedBusinessHours = parseJsonField(settingsData.business_hours, []);
            
            const enrichedSite = {
              ...mergedSite,
              settings: {
                id: settingsData.id,
                site_id: settingsData.site_id,
                about: settingsData.about,
                company_size: settingsData.company_size,
                industry: settingsData.industry,
                products: parseJsonField(settingsData.products, []),
                services: parseJsonField(settingsData.services, []),
                swot: parseJsonField(settingsData.swot, {
                  strengths: '',
                  weaknesses: '',
                  opportunities: '',
                  threats: ''
                }),
                locations: parseJsonField(settingsData.locations, []),
                business_hours: parsedBusinessHours,
                marketing_budget: parseJsonField(settingsData.marketing_budget, {
                  total: 0,
                  available: 0
                }),
                marketing_channels: parseJsonField(settingsData.marketing_channels, []),
                social_media: parseJsonField(settingsData.social_media, []),
                team_members: parseJsonField(settingsData.team_members, []),
                team_roles: parseJsonField(settingsData.team_roles, []),
                org_structure: parseJsonField(settingsData.org_structure, {}),
                calendars: parseJsonField(settingsData.calendars, []),
                activities: parseJsonField(settingsData.activities, {
                  daily_resume_and_stand_up: { status: 'default' },
                  local_lead_generation: { status: 'default' },
                  icp_lead_generation: { status: 'default' },
                  leads_initial_cold_outreach: { status: 'default' },
                  leads_follow_up: { status: 'default' },
                  email_sync: { status: 'default' }
                }),
                created_at: settingsData.created_at,
                updated_at: settingsData.updated_at,
                competitors: parseJsonField(settingsData.competitors, []),
                focus_mode: settingsData.focus_mode,
                goals: parsedGoals,
                channels: parseJsonField(settingsData.channels, {
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
                  }
                }),
                branding: parseJsonField(settingsData.branding, {
                  purpose: "",
                  values: "",
                  personality: "",
                  tone_of_voice: "",
                  positioning: "",
                  unique_value_proposition: "",
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
                }),
                customer_journey: parseJsonField(settingsData.customer_journey, {
                  awareness: { metrics: [], actions: [], tactics: [] },
                  consideration: { metrics: [], actions: [], tactics: [] },
                  decision: { metrics: [], actions: [], tactics: [] },
                  purchase: { metrics: [], actions: [], tactics: [] },
                  retention: { metrics: [], actions: [], tactics: [] },
                  referral: { metrics: [], actions: [], tactics: [] }
                }),
                shop: parseJsonField(settingsData.shop, {
                  hero_title: "",
                  hero_subtitle: "",
                  hero_cta_label: "Shop Now",
                  hero_cta_destination_type: "scroll",
                  hero_cta_destination_value: "",
                  hero_order_bar: false,
                  hero_image_url: "",
                  free_shipping_threshold: null,
                  return_policy_summary: "30-Day Returns",
                  trust_badges: [],
                  payment_methods: ['card', 'cash_on_pickup'],
                  default_delivery_options: ['pickup', 'ship', 'dine_in']
                }),
                printers: parseJsonField(settingsData.printers, { devices: [] }),
                currency: settingsData.currency || "USD",
                default_locale: (["en", "es", "fr", "de", "ja"] as const).includes(
                  (settingsData as { default_locale?: string }).default_locale as
                    | "en"
                    | "es"
                    | "fr"
                    | "de"
                    | "ja"
                )
                  ? ((settingsData as { default_locale?: string }).default_locale as
                      | "en"
                      | "es"
                      | "fr"
                      | "de"
                      | "ja")
                  : "en",
                business_model: (() => {
                  const parsed = parseJsonField(settingsData.business_model, { b2b: false, b2c: false, b2b2c: false });
                  return parsed;
                })()
                // allowed_domains is handled in a separate table, not in settings
              }
            };
            
            // Actualizar solo si sigue siendo el mismo sitio actual (por si el usuario cambió rápido)
            setCurrentSite(current => current?.id === enrichedSite.id ? enrichedSite : current);
          }
        } else {
        }
      } catch (err) {
        console.error(`Error handling settings for site ${site.id}:`, err);
        // Continuamos con el sitio sin settings en caso de error
      }
    } else {
      // Establecer el sitio como actual (para casos sin ID válido)
      setCurrentSite(site)
    }
}

export async function fetchSiteSettings(supabase: any, siteId: string) {
  if (!supabase || !siteId) {
    throw new Error("Supabase client not initialized or no site ID")
  }
  if (siteId.startsWith("demo-")) {
    const { getDemoData } = await import("@/lib/demo-data/index")
    return getDemoData(siteId)?.settings || null
  }
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("site_id", siteId)
    .single()
  if (error && error.code !== "PGRST116") {
    throw error
  }
  if (data) {
    data.social_media = parseJsonField(data.social_media, [])
    data.calendars = parseJsonField(data.calendars, [])
    data.goals = parseJsonField(data.goals, {
      quarterly: "",
      yearly: "",
      fiveYear: "",
      tenYear: "",
    })
    data.shop = parseJsonField(data.shop, null)
  }
  return data || null
}
