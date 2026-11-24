"use client"

import type { Site } from "./site-types"
import { setLocalStorage } from "./site-storage"
import { normalizeActivitySettings } from "@/app/components/settings/activity-settings"
import { preserveHydratedBilling } from "./site-billing-freshness"
import { readOnboardingProgress } from "@/app/lib/onboarding-completion"

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
  requireSettings?: boolean
  signal?: AbortSignal
}

export const SITE_DETAIL_TIMEOUT_MS = 8_000
type ReadResult<T> = { data: T | null; error: { code?: string } | null }
type FilteredRead<T> = { single(): PromiseLike<ReadResult<T>>; abortSignal?(signal: AbortSignal): FilteredRead<T> }
function readSelectedRow<T>(query: FilteredRead<T>, signal?: AbortSignal) {
  // PostgREST and the lazy demo client accept a signal on the filtered builder.
  return (signal && query.abortSignal ? query.abortSignal(signal) : query).single()
}

function readSelectionSettings(site: Site, supabase: SetCurrentArgs['supabase'], requireSettings: boolean, signal?: AbortSignal) {
  if (!requireSettings && site.settings) return { data: site.settings, error: null }
  const query = supabase.from('settings').select('*').eq('site_id', site.id)
  if (!requireSettings) return readSelectedRow(query, signal)
  // maybeSingle distinguishes a successful zero-row result from PGRST116 for
  // multiple rows. An ambiguous response is not an absent configuration.
  return (signal ? query.abortSignal(signal) : query).maybeSingle()
}

type SiteDetail = Partial<Pick<Site, 'name' | 'description' | 'logo_url' | 'tracking' | 'resource_urls'>>

function startDetailRead({ site, supabase, signal, setCurrentSite, setSites }: SetCurrentArgs) {
  if (site.logo_url != null && site.description != null) return
  const controller = new AbortController()
  const cancel = () => controller.abort()
  const timer = setTimeout(cancel, SITE_DETAIL_TIMEOUT_MS)
  const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel) }
  controller.signal.addEventListener('abort', cleanup, { once: true })
  signal?.addEventListener('abort', cancel, { once: true })

  let settingsAccepted = false
  let readyDetail: SiteDetail | null = null
  function publish() {
    if (!settingsAccepted || !readyDetail || signal?.aborted || controller.signal.aborted) return
    const detail = readyDetail
    readyDetail = null
    // Patch only the read columns on live state. A metadata refresh or edit
    // after this read began wins over its corresponding older field.
    const merge = (current: Site): Site => {
      if (current.id !== site.id || signal?.aborted || controller.signal.aborted) return current
      const next = { ...current }
      if (detail.name && current.name === site.name) next.name = detail.name
      if (detail.description != null && current.description === site.description) next.description = detail.description
      if (detail.logo_url !== undefined && current.logo_url === site.logo_url) next.logo_url = detail.logo_url
      if (detail.tracking !== undefined && current.tracking === site.tracking) next.tracking = detail.tracking
      if (detail.resource_urls !== undefined && current.resource_urls === site.resource_urls) next.resource_urls = detail.resource_urls
      return next
    }
    setSites(previous => previous.map(merge))
    setCurrentSite(previous => previous ? merge(previous) : previous)
  }
  void (async () => {
    try {
      const { data, error } = await readSelectedRow<SiteDetail>(supabase.from('sites')
        .select('logo_url, tracking, resource_urls, description, name').eq('id', site.id), controller.signal)
      if (error || !data || signal?.aborted || controller.signal.aborted) return
      readyDetail = data
      publish()
    } catch { /* Optional metadata cannot fail or complete required settings. */ }
    finally { cleanup(); controller.signal.removeEventListener('abort', cleanup) }
  })()
  return { accept: () => { settingsAccepted = true; publish() }, cancel }
}

export async function applyCurrentSite({
  site,
  currentSite,
  supabase,
  setCurrentSite,
  setSites,
  requireSettings = false,
  signal,
}: SetCurrentArgs) {
    
    // Skip if we're setting the same site (avoid unnecessary reloads on focus changes)
    if (signal?.aborted || (currentSite && site && currentSite.id === site.id)) {
      return;
    }
    
    if (site && site.id) {
      // Publish the identity immediately; operational readiness still waits for settings.
      setLocalStorage("currentSiteId", site.id)
      // Directory/CRUD rows may contain a resource mirror or a settings patch.
      // Neither proves that checkout, currency and printer settings have loaded.
      const supplied = requireSettings ? undefined : site.settings
      const optimisticSite = { ...site, settings_read_status: undefined, settings: supplied ? { ...supplied, activities: normalizeActivitySettings(supplied.activities) } : undefined }
      setCurrentSite(current => signal?.aborted ? current : current ? preserveHydratedBilling(current, optimisticSite) : optimisticSite)
      
      let details: ReturnType<typeof startDetailRead>
      try {
        if (requireSettings && (!supabase || supabase._isMock || supabase._isDemo)) {
          throw new Error('Selected site settings could not be loaded. Please try again.')
        }
        if (supabase) {
          const settingsRead = readSelectionSettings(site, supabase, requireSettings, signal)
          details = startDetailRead({ site, currentSite, supabase, setCurrentSite, setSites, signal })
          const { data, error: settingsError } = await settingsRead
          if (signal?.aborted) return
          if (settingsError && (requireSettings || settingsError.code !== 'PGRST116')) {
            details?.cancel()
            if (requireSettings) throw new Error("Selected site settings could not be loaded. Please try again.")
            console.error(`Error loading settings for site ${site.id}:`, settingsError)
            return
          }
          if (requireSettings && data !== null && (!data || typeof data !== 'object' || Array.isArray(data) ||
              (data.site_id !== undefined && data.site_id !== site.id))) throw new Error('Selected site settings could not be loaded. Please try again.')
          const settingsData = unwrapSettingsRow(data)
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
            
            const settings = {
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
                activities: normalizeActivitySettings(parseJsonField(settingsData.activities, {})),
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
            };

            const progress = 'onboarding' in settingsData ? { onboardingProgress: readOnboardingProgress(settingsData.onboarding) } : {}
            setCurrentSite(current => !signal?.aborted && current?.id === site.id ? { ...current, settings,
              ...(requireSettings ? { settings_read_status: 'loaded' as const } : {}), ...progress } : current)
          } else if (requireSettings) {
            setCurrentSite(current => !signal?.aborted && current?.id === site.id
              ? { ...current, settings_read_status: 'missing', settings: undefined } : current)
          }
          // Already resolved detail is published before the selection promise
          // resolves. An unresolved read remains optional and independently bounded.
          details?.accept()
        }
      } catch (err) {
        details?.cancel()
        if (signal?.aborted) return
        if (requireSettings) throw err;
        console.error(`Error handling settings for site ${site.id}:`, err);
      }
    } else {
      setCurrentSite(site)
    }
}

function unwrapSettingsRow(data: any) {
  if (!data) return null
  return Array.isArray(data) ? data[0] || null : data
}

export async function fetchSiteSettings(supabase: any, siteId: string) {
  if (!supabase || !siteId) {
    throw new Error("Supabase client not initialized or no site ID")
  }
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("site_id", siteId)
    .single()
  if (error && error.code !== "PGRST116") {
    throw error
  }
  const row = unwrapSettingsRow(data)
  if (row) {
    row.activities = normalizeActivitySettings(parseJsonField(row.activities, {}))
    row.social_media = parseJsonField(row.social_media, [])
    row.calendars = parseJsonField(row.calendars, [])
    row.goals = parseJsonField(row.goals, {
      quarterly: "",
      yearly: "",
      fiveYear: "",
      tenYear: "",
    })
    row.shop = parseJsonField(row.shop, null)
  }
  return row || null
}
