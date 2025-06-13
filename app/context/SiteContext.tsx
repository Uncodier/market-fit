"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, usePathname } from "next/navigation"
import type { Tables } from "@/lib/types/database.types"
import type { 
  Location, 
  SwotAnalysis, 
  TeamMember, 
  MarketingChannel, 
  SocialMedia,
  MarketingBudget
} from "@/lib/types/database.types"
import { billingService, BillingData } from "../services/billing-service"
import { toast } from "react-hot-toast"

// Definición de la interfaz Site adaptada a la estructura de Supabase
export interface Site {
  id: string
  name: string
  url: string | null
  description: string | null
  logo_url: string | null
  user_id: string
  created_at: string
  updated_at: string
  resource_urls: ResourceUrl[] | null
  tracking?: {
    track_visitors: boolean;
    track_actions: boolean;
    record_screen: boolean;
    enable_chat: boolean;
    chat_accent_color?: string;
    allow_anonymous_messages?: boolean;
    chat_position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
    welcome_message?: string;
    chat_title?: string;
    analytics_provider?: string;
    analytics_id?: string;
    tracking_code?: string;
  }
  billing?: {
    plan: 'commission' | 'startup' | 'enterprise'
    masked_card_number?: string
    card_name?: string
    card_expiry?: string
    stripe_customer_id?: string
    stripe_payment_method_id?: string
    card_address?: string
    card_city?: string
    card_postal_code?: string
    card_country?: string
    tax_id?: string
    billing_address?: string
    billing_city?: string
    billing_postal_code?: string
    billing_country?: string
    auto_renew: boolean
    credits_available?: number
  }
  // New settings data
  settings?: SiteSettings
}

export interface SiteSettings {
  id?: string
  site_id?: string
  about?: string | null
  company_size?: string | null
  industry?: string | null
  products?: Product[] | null
  services?: Service[] | null
  swot?: SwotAnalysis | null
  locations?: Location[] | null
  business_hours?: BusinessHours[] | null
  marketing_budget?: MarketingBudget | null
  marketing_channels?: MarketingChannel[] | null
  social_media?: SocialMedia[] | null
  team_members?: TeamMember[] | null
  team_roles?: { name: string; permissions: string[]; description?: string }[] | null
  org_structure?: Record<string, any> | null
  created_at?: string
  updated_at?: string
  competitors?: CompetitorUrl[] | null
  focus_mode?: number
  goals?: {
    quarterly?: string
    yearly?: string
    fiveYear?: string
    tenYear?: string
  } | null
  channels?: {
    email?: {
      enabled: boolean
      email: string
      password: string
      incomingServer?: string
      incomingPort?: string
      outgoingServer?: string
      outgoingPort?: string
      status?: "not_configured" | "password_required" | "pending_sync" | "synced"
    }
    whatsapp?: {
      enabled?: boolean
      setupType?: "new_number" | "use_own_account"
      country?: string
      region?: string
      number?: string
      existingNumber?: string
      setupRequested?: boolean
      apiToken?: string
      account_sid?: string
      status?: "not_configured" | "pending" | "active"
    }
  } | null
  // allowed_domains is handled in a separate table, not in settings
  // allowed_domains?: Array<{
  //   id?: string
  //   domain: string
  //   site_id?: string
  // }> | null
}

export interface ResourceUrl {
  key: string
  url: string
}

export interface BusinessHours {
  name: string
  timezone: string
  respectHolidays?: boolean
  days: {
    monday: { enabled: boolean; start?: string; end?: string }
    tuesday: { enabled: boolean; start?: string; end?: string }
    wednesday: { enabled: boolean; start?: string; end?: string }
    thursday: { enabled: boolean; start?: string; end?: string }
    friday: { enabled: boolean; start?: string; end?: string }
    saturday: { enabled: boolean; start?: string; end?: string }
    sunday: { enabled: boolean; start?: string; end?: string }
  }
}

export interface CompetitorUrl {
  url: string
  name?: string
}

export interface Product {
  name: string
  description?: string
  cost?: number
  lowest_sale_price?: number
  target_sale_price?: number
}

export interface Service {
  name: string
  description?: string
  cost?: number
  lowest_sale_price?: number
  target_sale_price?: number
}

// Interfaz del contexto
interface SiteContextType {
  sites: Site[]
  currentSite: Site | null
  isLoading: boolean
  error: Error | null
  setCurrentSite: (site: Site) => void
  updateSite: (site: Site) => Promise<void>
  createSite: (site: Omit<Site, 'id' | 'created_at' | 'updated_at'>) => Promise<Site>
  deleteSite: (id: string) => Promise<void>
  refreshSites: () => Promise<void>
  updateSettings: (siteId: string, settings: Partial<SiteSettings>) => Promise<void>
  getSettings: (siteId: string) => Promise<SiteSettings | null>
  updateBilling: (siteId: string, billingData: BillingData) => Promise<{ success: boolean; error?: string }>
  getBillingInfo: (siteId: string) => Promise<any>
  purchaseCredits: (siteId: string, amount: number) => Promise<{ success: boolean; error?: string }>
}

// Crear el contexto
const SiteContext = createContext<SiteContextType | undefined>(undefined)

// Hook personalizado para usar el contexto
export function useSite() {
  const context = useContext(SiteContext)
  if (context === undefined) {
    throw new Error("useSite must be used within a SiteProvider")
  }
  return context
}

// Props del proveedor
interface SiteProviderProps {
  children: ReactNode
}

/**
 * Limpia un UUID de comillas extras o caracteres no válidos
 * @param id Posible UUID con formato incorrecto
 * @returns UUID limpio o null si no es válido
 */
function cleanUUID(id: string | null): string | null {
  if (!id) return null
  
  // Eliminar comillas extras si existen
  let cleaned = id.replace(/["']/g, '')
  
  // Verificar el formato básico de UUID después de limpiar
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleaned)) {
    return cleaned
  }
  
  // Caso especial para "default" u otros valores especiales
  if (cleaned === "default") return cleaned
  
  console.warn("UUID inválido después de limpieza:", id, "->", cleaned)
  return null
}

// Función segura para acceder a localStorage
function getLocalStorage(key: string, defaultValue: any = null) {
  if (typeof window === 'undefined') return defaultValue
  
  try {
    const rawValue = localStorage.getItem(key)
    if (rawValue === null) return defaultValue
    
    // Manejar acceso directo para UUIDs y otros IDs para evitar errores de JSON.parse
    if (key.toLowerCase().includes('id')) {
      // Para IDs, devolver directamente el valor sin parsear
      if (key === 'currentSiteId') {
        console.log(`Acceso directo a ${key}:`, rawValue)
        
        // Si es un UUID, intentar limpiarlo
        const cleanedValue = cleanUUID(rawValue)
        
        if (cleanedValue && cleanedValue !== rawValue) {
          // Si el valor limpio es diferente, actualizar localStorage
          try {
            localStorage.setItem(key, cleanedValue)
            console.log(`UUID corregido en localStorage: ${key} = ${cleanedValue}`)
          } catch (e) {
            console.error(`Error al corregir UUID en localStorage:`, e)
          }
          return cleanedValue
        }
        
        return rawValue
      }
    }
    
    // Para otros valores, intentar parsear como JSON, pero con manejo de errores
    try {
      return JSON.parse(rawValue)
    } catch (jsonError) {
      console.warn(`Valor en localStorage para "${key}" no es JSON válido, usando como texto plano:`, rawValue)
      return rawValue
    }
  } catch (e) {
    console.error(`Error al leer localStorage key "${key}":`, e)
    return defaultValue
  }
}

// Función segura para guardar en localStorage
function setLocalStorage(key: string, value: any) {
  if (typeof window === 'undefined') return
  
  try {
    // Caso especial para currentSiteId - siempre guardar como string plano
    if (key === 'currentSiteId') {
      let valueToStore = value
      
      // Si es un string, intentar limpiarlo de comillas si es un UUID
      if (typeof value === 'string') {
        const cleanedValue = cleanUUID(value)
        if (cleanedValue) {
          valueToStore = cleanedValue
        }
      }
      
      console.log(`Guardando ${key} directamente:`, valueToStore)
      localStorage.setItem(key, valueToStore)
      return
    }
    
    // Para otros IDs, también guardar como string plano si es un UUID
    if (key.toLowerCase().includes('id') && typeof value === 'string') {
      const cleanedValue = cleanUUID(value)
      if (cleanedValue) {
        console.log(`Guardando ID limpio en ${key}:`, cleanedValue)
        localStorage.setItem(key, cleanedValue)
        return
      }
    }
    
    // Para objetos y arrays, usar JSON.stringify
    if (typeof value === 'object' && value !== null) {
      localStorage.setItem(key, JSON.stringify(value))
      return
    }
    
    // Para valores simples (string, number, boolean), guardar directamente
    localStorage.setItem(key, String(value))
  } catch (e) {
    console.error(`Error al guardar en localStorage key "${key}":`, e)
  }
}

// Componente proveedor
export function SiteProvider({ children }: SiteProviderProps) {
  const [currentSite, setCurrentSite] = useState<Site | null>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  
  // Navigation hooks
  const router = useRouter()
  const pathname = usePathname()
  
  // Referencia segura a supabase (inicializada solo en useEffect)
  const supabaseRef = useRef<any>(null)
  
  // Helper function to parse JSON fields from the database
  const parseJsonField = (field: any, defaultValue: any) => {
    if (!field) return defaultValue;
    
    try {
      // If it's already an object/array, return it
      if (typeof field === 'object') {
        // Special handling for arrays to ensure they're valid
        if (Array.isArray(field)) {
          return field;
        }
        return field;
      }
      
      // If it's a string, try to parse it
      if (typeof field === 'string') {
        console.log(`Parsing JSON string: ${field}`);
        const parsed = JSON.parse(field);
        
        // Special handling for products and services to ensure they're valid arrays
        if (Array.isArray(parsed)) {
          return parsed;
        }
        
        // Special handling for goals to ensure correct structure
        if (defaultValue && defaultValue.quarterly !== undefined) {
          // This is probably goals data
          console.log("Detected goals data:", parsed);
          return {
            quarterly: typeof parsed.quarterly === 'string' ? parsed.quarterly : '',
            yearly: typeof parsed.yearly === 'string' ? parsed.yearly : '',
            fiveYear: typeof parsed.fiveYear === 'string' ? parsed.fiveYear : '',
            tenYear: typeof parsed.tenYear === 'string' ? parsed.tenYear : ''
          };
        }
        
        return parsed;
      }
      
      return defaultValue;
    } catch (error) {
      console.error("Error parsing JSON field:", error, "Raw value:", field);
      return defaultValue;
    }
  };
  
  // Marcar que el componente está montado (solo después de hidratación)
  useEffect(() => {
    setIsMounted(true)
    
    // Diagnóstico: imprimir el contenido actual de localStorage para debuggear
    if (typeof window !== 'undefined') {
      try {
        console.log("==== Diagnóstico de localStorage ====")
        const currentSiteId = localStorage.getItem('currentSiteId')
        console.log(`currentSiteId (raw): "${currentSiteId}"`)
        
        if (currentSiteId) {
          const cleanedId = cleanUUID(currentSiteId)
          console.log(`currentSiteId (limpio): "${cleanedId}"`)
          
          // Corregir si es necesario
          if (cleanedId && cleanedId !== currentSiteId) {
            localStorage.setItem('currentSiteId', cleanedId)
            console.log("ID corregido automáticamente en localStorage")
          }
        }
        console.log("===================================")
      } catch (e) {
        console.error("Error en diagnóstico de localStorage:", e)
      }
    }
    
    return () => setIsMounted(false)
  }, [])
  
  // Inicializar el cliente Supabase solo después de la hidratación
  useEffect(() => {
    if (!isMounted) return
    
    try {
      supabaseRef.current = createClient()
    } catch (err) {
      console.error("Error initializing Supabase client:", err)
    }
  }, [isMounted])
  
  // Cargar sitios desde Supabase
  const loadSites = async () => {
    if (!isMounted || !supabaseRef.current) {
      console.log("Cannot load sites:", { isMounted, hasSupabaseClient: !!supabaseRef.current })
      return
    }
    
    try {
      if (!isInitialized) setIsLoading(true)
      setError(null)
      
      console.log("Getting user session...")
      const { data: { session } } = await supabaseRef.current.auth.getSession()
      
      if (!session) {
        console.log("No active session found")
        setIsLoading(false)
        return
      }
      
      console.log("Fetching sites for user:", session.user.id)
      
      // Fetch user's own sites
      const { data: ownedSitesData, error: ownedSitesError } = await supabaseRef.current
        .from('sites')
        .select('*')
        .eq('user_id', session.user.id)
      
      if (ownedSitesError) {
        console.error("Error fetching owned sites:", ownedSitesError)
        throw ownedSitesError
      }
      
      // Fetch sites where the user is a member (shared with the user)
      const { data: sharedSiteIds, error: sharedSitesError } = await supabaseRef.current
        .from('site_members')
        .select('site_id')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .neq('role', 'owner') // Exclude own sites where user is explicitly marked as owner
      
      if (sharedSitesError) {
        console.error("Error fetching shared site IDs:", sharedSitesError)
        throw sharedSitesError
      }
      
      // Extract the site IDs from the site_members result
      const sharedIds = sharedSiteIds.map((item: { site_id: string }) => item.site_id)
      let sharedSitesData: any[] = []
      
      // If there are shared sites, fetch their details
      if (sharedIds.length > 0) {
        const { data: sharedSites, error: fetchSharedError } = await supabaseRef.current
          .from('sites')
          .select('*')
          .in('id', sharedIds)
        
        if (fetchSharedError) {
          console.error("Error fetching shared sites data:", fetchSharedError)
          throw fetchSharedError
        }
        
        sharedSitesData = sharedSites || []
      }
      
      // Combine owned and shared sites
      const allSitesData = [...(ownedSitesData || []), ...sharedSitesData]
      
      console.log("Sites fetched successfully:", allSitesData.length, "sites found")
      console.log("- Owned sites:", ownedSitesData?.length || 0)
      console.log("- Shared sites:", sharedSitesData.length)
      
      // Cargar focusMode desde localStorage o usar focus_mode de la base de datos
      const sitesWithData = allSitesData.map((site: Tables<'sites'>) => {
        return {
          ...site,
          focus_mode: getLocalStorage(`site_${site.id}_focus_mode`, site.focus_mode || 50),
          // No incluimos settings aquí, se cargarán específicamente para el sitio actual
          settings: undefined
        }
      })
      
      console.log("Sites prepared:", sitesWithData)
      setSites(sitesWithData as Site[])
      
      // Si hay sitios, intentamos restaurar el sitio guardado o usar el primero
      if (sitesWithData.length > 0) {
        const savedSiteId = getLocalStorage("currentSiteId")
        const savedSite = savedSiteId ? sitesWithData.find((site: any) => site.id === savedSiteId) : null
        
        // PRIORIDAD 1: Si hay un sitio guardado válido, usarlo siempre
        if (savedSite) {
          await handleSetCurrentSite(savedSite)
        } 
        // PRIORIDAD 2: Si estamos durante la inicialización y no hay sitio guardado, usar el primero
        else if (!isInitialized && sitesWithData.length > 0) {
          await handleSetCurrentSite(sitesWithData[0])
          setLocalStorage("currentSiteId", sitesWithData[0].id)
        }
        // PRIORIDAD 3: Si ya estamos inicializados, tenemos sitio actual, pero no está guardado
        else if (isInitialized && currentSite && !savedSite) {
          // Verificar que el sitio actual aún existe en la lista
          const existingSite = sitesWithData.find((site: any) => site.id === currentSite.id)
          if (existingSite) {
            await handleSetCurrentSite(existingSite)
          } else {
            await handleSetCurrentSite(sitesWithData[0])
          }
        }
        // PRIORIDAD 4: Caso fallback - no hay sitio actual ni guardado
        else if (!currentSite && sitesWithData.length > 0) {
          await handleSetCurrentSite(sitesWithData[0])
        }
      }

      if (!isInitialized) {
        setIsInitialized(true)
      }
    } catch (err) {
      console.error("Error loading sites:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }
  
  // Cargar sitios al iniciar el provider, pero solo después de la hidratación
  useEffect(() => {
    if (!isMounted || !supabaseRef.current) return
    
    loadSites()
    
    // Suscribirse a eventos de autenticación para cargar sitios cuando el usuario inicie sesión
    const { data: { subscription } } = supabaseRef.current.auth.onAuthStateChange(
      (event: 'SIGNED_IN' | 'SIGNED_OUT' | 'USER_UPDATED' | 'PASSWORD_RECOVERY' | 'TOKEN_REFRESHED', session: any) => {
        if (event === 'SIGNED_IN') {
          console.log('User signed in, loading sites...')
          loadSites()
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out, clearing sites...')
          setSites([])
          setCurrentSite(null)
          try {
            localStorage.removeItem("currentSiteId")
          } catch (e) {
            console.error("Error removing currentSiteId from localStorage:", e)
          }
        }
      }
    )
    
    return () => {
      subscription.unsubscribe()
    }
  }, [isMounted])

  // Efecto separado para manejar las suscripciones, solo después de la inicialización
  useEffect(() => {
    if (!isInitialized || !isMounted || !supabaseRef.current) return

    // Only subscribe after a delay to avoid immediate triggers during initialization
    const subscriptionTimer = setTimeout(() => {
      // Suscribirse a cambios en la tabla sites
      const sitesSubscription = supabaseRef.current
        .channel('sites-db-changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'sites' 
        }, (payload: { eventType: string; new: any; old: any }) => {
          console.log('Sites subscription triggered:', payload.eventType);
          
          // Be more conservative about when to reload
          if (payload.eventType === 'INSERT') {
            // Only reload if this is a new site for current user
            console.log('New site created, reloading sites list');
            loadSites();
          } else if (payload.eventType === 'DELETE') {
            // Only reload if the deleted site affects current user
            console.log('Site deleted, reloading sites list');
            loadSites();
          } else if (payload.eventType === 'UPDATE') {
            // For updates, be very selective - only reload if it's the current site AND it's a significant change
            const newRecord = payload.new as Site;
            if (currentSite?.id === newRecord.id) {
              // Check if it's a significant change that would affect the settings page
              const oldRecord = payload.old as Site;
              const significantChanges = newRecord.name !== oldRecord.name || 
                                       newRecord.url !== oldRecord.url ||
                                       newRecord.description !== oldRecord.description;
              
              if (significantChanges) {
                console.log('Significant site update detected, reloading');
                loadSites();
              }
            }
          }
        })
        .subscribe()
      
      // Remove the settings subscription entirely to prevent constant reloading
      // Settings changes will be handled through the manual save process
      
      return () => {
        try {
          sitesSubscription.unsubscribe()
        } catch (error) {
          console.error("Error unsubscribing from sites channel:", error)
        }
      }
    }, 2000); // Delay subscription by 2 seconds to avoid initialization conflicts
    
    return () => {
      clearTimeout(subscriptionTimer);
    }
  }, [isInitialized, isMounted]) // Removed currentSite?.id dependency to prevent re-subscriptions

  // Redirect to /create-site if user has no sites
  useEffect(() => {
    // Only redirect if:
    // 1. Component is mounted and initialized
    // 2. Not currently loading
    // 3. No sites available
    // 4. Not already on create-site page or auth pages
    // 5. User has a session (authenticated)
    if (
      isMounted && 
      isInitialized && 
      !isLoading && 
      sites.length === 0 && 
      !pathname.startsWith('/create-site') && 
      !pathname.startsWith('/auth/') &&
      supabaseRef.current
    ) {
      // Check if user is authenticated before redirecting
      supabaseRef.current.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
        if (session) {
          console.log("No sites found for authenticated user, redirecting to /create-site")
          router.push('/create-site')
        }
      }).catch((error: any) => {
        console.error("Error checking session for redirect:", error)
      })
    }
  }, [isMounted, isInitialized, isLoading, sites.length, pathname, router])
  
  // Guardar el sitio seleccionado en localStorage cuando cambie
  const handleSetCurrentSite = async (site: Site) => {
    
    // Solo guardar si es un sitio válido y no es el 'default'
    if (site && site.id) {
      try {
        // Cargar los settings específicamente para este sitio
        if (!site.settings && supabaseRef.current) {

          const { data: settingsData, error: settingsError } = await supabaseRef.current
            .from('settings')
            .select('*')
            .eq('site_id', site.id)
            .single();
          
          if (settingsError && settingsError.code !== 'PGRST116') {
            // PGRST116 significa que no se encontraron registros (es normal para un sitio nuevo)
            console.error(`Error loading settings for site ${site.id}:`, settingsError);
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
            
            site = {
              ...site,
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
                    status: "not_configured"
                  }
                })
                // allowed_domains is handled in a separate table, not in settings
              }
            };
          }
        } else {
          console.log("Skipping settings load because:", {
            hasSettings: !!site.settings,
            hasSupabase: !!supabaseRef.current
          });
        }
      } catch (err) {
        console.error(`Error handling settings for site ${site.id}:`, err);
        // Continuamos con el sitio sin settings en caso de error
      }
      
      // Guardar el ID directamente - nuestra función setLocalStorage ya maneja la limpieza
      setLocalStorage("currentSiteId", site.id)
    }
    
    // Establecer el sitio como actual
    setCurrentSite(site)
  }

  // Actualizar un sitio en Supabase
  const handleUpdateSite = async (site: Site) => {
    try {
      // Don't set isLoading to avoid UI interruptions during save
      // setIsLoading(true);
      
      // Extract tracking data for clean update
      const trackingData = site.tracking || {
        track_visitors: false,
        track_actions: false,
        record_screen: false
      };
      
      // Update the site record
      const { data: updatedSiteData, error: updateError } = await supabaseRef.current
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
        await handleUpdateSettings(site.id, site.settings)
      }
      
      // Don't automatically reload sites to prevent constant recompilation
      // The UI will handle local state updates as needed
      // await loadSites() // Reload the sites to get updated data
      
    } catch (err) {
      console.error("Error updating site:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    } finally {
      // setIsLoading(false) // Not needed since we don't set it to true
    }
  }
  
  // Crear un nuevo sitio
  const handleCreateSite = async (newSite: Omit<Site, 'id' | 'created_at' | 'updated_at'>): Promise<Site> => {
    try {
      setIsLoading(true);
      
      // Ensure user is authenticated
      const { data: { session } } = await supabaseRef.current.auth.getSession();
      if (!session) throw new Error("User not authenticated");
      
      // Crear el nuevo sitio en la base de datos
      const now = new Date().toISOString();
      const { data: createdSiteData, error: createError } = await supabaseRef.current
        .from('sites')
        .insert({
          name: newSite.name,
          url: newSite.url || null,
          description: newSite.description || null,
          logo_url: newSite.logo_url,
          resource_urls: newSite.resource_urls,
          tracking: newSite.tracking,
          user_id: session.user.id,
          created_at: now,
          updated_at: now
        })
        .select()
      
      if (createError) throw createError;
      if (!createdSiteData || createdSiteData.length === 0) throw new Error("Could not create site");
      
      // Iniciar con un sitio vacío
      const createdSite = {
        ...createdSiteData[0],
        settings: {}
      } as Site;
      
      // Crear configuración inicial si el sitio se creó correctamente
      if (createdSite && createdSite.id) {
        // Valores iniciales para settings
        const initialSettings: Partial<SiteSettings> = {
          site_id: createdSite.id,
          // Asignar los valores iniciales para competitors y focusMode que ahora pertenecen a settings
          competitors: [],
          focus_mode: 50
        };
        
        try {
          await handleUpdateSettings(createdSite.id, initialSettings);
          
          // Actualizar el objeto createdSite con los settings iniciales
          createdSite.settings = initialSettings as SiteSettings;
        } catch (settingsError) {
          console.error("Error creating initial settings:", settingsError);
        }
      }
      
      await loadSites() // Recargar los sitios
      
      // Si es el primer sitio, lo establecemos como actual
      if (sites.length === 0) {
        await handleSetCurrentSite(createdSite);
      }
      
      return createdSite
    } catch (err) {
      console.error("Error creating site:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    }
  }
  
  // Eliminar un sitio
  const handleDeleteSite = async (id: string) => {
    if (!supabaseRef.current) return Promise.reject(new Error("Supabase client not initialized"))
    
    try {
      setError(null)
      
      const { error } = await supabaseRef.current
        .from('sites')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      await loadSites() // Recargar los sitios
      
      // Si el sitio eliminado es el actual, cambiamos a otro
      if (currentSite?.id === id && sites.length > 0) {
        const newCurrentSite = sites.find(site => site.id !== id)
        if (newCurrentSite) handleSetCurrentSite(newCurrentSite).catch(err => {
          console.error("Error setting new current site after delete:", err);
        });
      }
    } catch (err) {
      console.error("Error deleting site:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    }
  }
  
  // Function to get settings for a site
  const handleGetSettings = async (siteId: string) => {
    if (!supabaseRef.current) return Promise.reject(new Error("Supabase client not initialized"))
    
    try {
      const { data, error } = await supabaseRef.current
        .from('settings')
        .select('*')
        .eq('site_id', siteId)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error // PGRST116 means no rows returned
      
      return data || null
    } catch (err) {
      console.error("Error getting settings:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    }
  }

  // Function to update settings
  const handleUpdateSettings = async (siteId: string, settings: Partial<SiteSettings>) => {
    try {
      console.log("UPDATE SETTINGS 1: Inicio del proceso");
      console.log("UPDATE SETTINGS 2: Data recibida:", {
        siteId, 
        goals: settings.goals
      });
      
      // Don't set isLoading to avoid UI interruptions during save
      // setIsLoading(true);
      const now = new Date().toISOString();
      
      console.log("UPDATE SETTINGS 3: Preparando datos formateados");
      
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
      
      // Nuevos campos migrados de site a settings
      if (settings.competitors !== undefined) {
        formattedSettings.competitors = Array.isArray(settings.competitors) ? settings.competitors : [];
      }
      
      if (settings.focus_mode !== undefined) {
        formattedSettings.focus_mode = typeof settings.focus_mode === 'number' ? settings.focus_mode : 50;
      }
      
      // Handle channels field
      if (settings.channels !== undefined) {
        console.log("UPDATE SETTINGS: Processing channels field:", settings.channels);
        formattedSettings.channels = typeof settings.channels === 'object' ? settings.channels : {
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
            status: "not_configured"
          }
        };
      }
      
      // Handle goals field
      if (settings.goals !== undefined) {
        console.log("UPDATE SETTINGS 4: Procesando campo goals:", settings.goals);
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
          console.log("UPDATE SETTINGS 5: Campo goals procesado para DB:", formattedSettings.goals);
          console.log("UPDATE SETTINGS 5: JSON.stringify result:", JSON.stringify(formattedSettings.goals));
        } catch (goalsSerializeError) {
          console.error("Error al serializar goals:", goalsSerializeError);
        }
      }
      
      console.log("UPDATE SETTINGS 6: Enviando datos a Supabase");
      console.log("UPDATE SETTINGS 7: Datos a guardar:", {
        site_id: formattedSettings.site_id,
        goals: formattedSettings.goals
      });
      
      // Remove allowed_domains from settings as it belongs to a separate table
      // Since allowed_domains is no longer part of SiteSettings interface, we just use formattedSettings directly
      const settingsForDB = formattedSettings;
      
      // Use upsert operation with site_id as the conflict resolution field
      try {
        console.log("UPDATE SETTINGS: Raw upsert data:", JSON.stringify(settingsForDB));
        console.log("UPDATE SETTINGS: Goals before upsert:", settingsForDB.goals);
        
        const { error } = await supabaseRef.current
          .from('settings')
          .upsert(settingsForDB, { 
            onConflict: 'site_id',
            ignoreDuplicates: false
          });
        
        if (error) {
          console.error("UPDATE SETTINGS ERROR en upsert:", error);
          console.error("UPDATE SETTINGS ERROR detalles:", error.code, error.message, error.details);
          throw error;
        }
        
        console.log("UPDATE SETTINGS 8: Datos guardados correctamente en Supabase");
        
        // Verificar que se guardaron correctamente los datos
        console.log("UPDATE SETTINGS: Verificando el guardado...");
        const { data: verifyData, error: verifyError } = await supabaseRef.current
          .from('settings')
          .select('goals')
          .eq('site_id', siteId)
          .single();
          
        if (verifyError) {
          console.error("UPDATE SETTINGS: Error al verificar guardado:", verifyError);
        } else {
          console.log("UPDATE SETTINGS: Datos verificados de la base:", verifyData);
          console.log("UPDATE SETTINGS: Goals guardados:", verifyData.goals);
        }
      } catch (upsertError) {
        console.error("UPDATE SETTINGS ERROR excepción en upsert:", upsertError);
        throw upsertError;
      }
      
      console.log("UPDATE SETTINGS 9: Recargando información");
      // Don't automatically reload sites after settings update to prevent constant reloading
      // The settings page will handle its own state updates
      // await loadSites();
      console.log("UPDATE SETTINGS 10: Proceso completado con éxito (sin reload automático)");
      
    } catch (err) {
      console.error("UPDATE SETTINGS ERROR GENERAL:", err);
      console.error("UPDATE SETTINGS ERROR tipo:", typeof err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      // setIsLoading(false); // Not needed since we don't set it to true
    }
  }

  const updateBilling = async (siteId: string, billingData: BillingData) => {
    try {
      setIsLoading(true);
      const result = await billingService.saveBillingInfo(siteId, billingData);
      
      if (result.success) {
        // Refresh site data to get the updated billing info
        await loadSites();
        toast.success("Billing information updated successfully");
      } else {
        toast.error(result.error || "Failed to update billing information");
      }
      
      return result;
    } catch (error) {
      console.error("Error updating billing:", error);
      toast.error("Failed to update billing information");
      return { success: false, error: "An unexpected error occurred" };
    } finally {
      setIsLoading(false);
    }
  };

  const getBillingInfo = async (siteId: string) => {
    try {
      return await billingService.getBillingInfo(siteId);
    } catch (error) {
      console.error("Error getting billing info:", error);
      return { data: null, error };
    }
  };

  const purchaseCredits = async (siteId: string, amount: number) => {
    try {
      setIsLoading(true);
      
      // Use our database RPC function directly
      const supabase = createClient();
      const { data, error } = await supabase.rpc('purchase_credits', {
        site_id: siteId,
        amount: amount,
        payment_method: 'credit_card'
      });
      
      if (error) {
        throw error;
      }
      
      // Refresh site data to get the updated credits
      await loadSites();
      toast.success(`Successfully purchased ${amount} credits`);
      
      return { success: true };
    } catch (error) {
      console.error("Error purchasing credits:", error);
      toast.error("Failed to purchase credits");
      return { success: false, error: "An unexpected error occurred" };
    } finally {
      setIsLoading(false);
    }
  };

  // Valor del contexto
  const value = {
    sites,
    currentSite: currentSite || null,
    isLoading,
    error,
    setCurrentSite: handleSetCurrentSite,
    updateSite: handleUpdateSite,
    createSite: handleCreateSite,
    deleteSite: handleDeleteSite,
    refreshSites: loadSites,
    updateSettings: handleUpdateSettings,
    getSettings: handleGetSettings,
    updateBilling,
    getBillingInfo,
    purchaseCredits,
  }
  
  return (
    <SiteContext.Provider value={value}>
      {children}
    </SiteContext.Provider>
  )
} 