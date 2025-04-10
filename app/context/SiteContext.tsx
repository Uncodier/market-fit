"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/types/database.types"
import type { 
  SwotAnalysis, 
  Location, 
  MarketingBudget, 
  TrackingSettings, 
  TeamMember, 
  MarketingChannel, 
  SocialMedia, 
  CalendarItem 
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
  competitors: CompetitorUrl[] | null
  focusMode: number
  focus_mode: number
  tracking?: TrackingSettings
  billing?: {
    plan: 'free' | 'starter' | 'professional' | 'enterprise'
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
  products?: string[] | null
  services?: string[] | null
  swot?: SwotAnalysis | null
  locations?: Location[] | null
  marketing_budget?: MarketingBudget | null
  marketing_channels?: MarketingChannel[] | null
  social_media?: SocialMedia[] | null
  target_keywords?: string[] | null
  content_calendar?: CalendarItem[] | null
  tracking_code?: string | null
  analytics_provider?: string | null
  analytics_id?: string | null
  team_members?: TeamMember[] | null
  team_roles?: { name: string; permissions: string[]; description?: string }[] | null
  org_structure?: Record<string, any> | null
  created_at?: string
  updated_at?: string
}

export interface ResourceUrl {
  key: string
  url: string
}

export interface CompetitorUrl {
  url: string
  name?: string
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
  
  // Referencia segura a supabase (inicializada solo en useEffect)
  const supabaseRef = useRef<any>(null)
  
  // Helper function to parse JSON fields from the database
  const parseJsonField = (field: any, defaultValue: any) => {
    if (!field) return defaultValue;
    
    try {
      // If it's already an object/array, return it
      if (typeof field === 'object') return field;
      
      // If it's a string, try to parse it
      if (typeof field === 'string') {
        return JSON.parse(field);
      }
      
      return defaultValue;
    } catch (error) {
      console.error("Error parsing JSON field:", error);
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
      const { data: sitesData, error: sitesError } = await supabaseRef.current
        .from('sites')
        .select('*')
        .eq('user_id', session.user.id)
      
      if (sitesError) {
        console.error("Error fetching sites:", sitesError)
        console.error("Error details:", {
          code: sitesError.code,
          message: sitesError.message,
          details: sitesError.details,
          hint: sitesError.hint
        })
        throw sitesError
      }
      
      console.log("Raw sites data:", sitesData)
      console.log("Sites fetched successfully:", sitesData?.length || 0, "sites found")
      
      // Get settings for all sites
      const siteIds = sitesData?.map((site: Tables<'sites'>) => site.id) || []
      let settingsData: Record<string, Tables<'settings'>> = {}
      
      if (siteIds.length > 0) {
        console.log("Fetching settings for sites:", siteIds)
        const { data: settings, error: settingsError } = await supabaseRef.current
          .from('settings')
          .select('*')
          .in('site_id', siteIds)
          
        if (settingsError) {
          console.error("Error fetching settings:", settingsError)
          throw settingsError
        }
        
        console.log("Settings data fetched:", settings)
        
        // Create a map of site_id to settings
        settingsData = (settings || []).reduce((acc: Record<string, Tables<'settings'>>, setting: Tables<'settings'>) => {
          acc[setting.site_id] = setting
          return acc
        }, {} as Record<string, Tables<'settings'>>)
      }
      
      // Cargar focusMode desde localStorage o usar focus_mode de la base de datos
      const sitesWithData = (sitesData || []).map((site: Tables<'sites'>) => {
        const siteSettings = settingsData[site.id]
        console.log(`Settings for site ${site.id}:`, siteSettings)
        
        return {
          ...site,
          focusMode: getLocalStorage(`site_${site.id}_focusMode`, site.focus_mode || 50),
          settings: siteSettings ? {
            id: siteSettings.id,
            site_id: siteSettings.site_id,
            about: siteSettings.about,
            company_size: siteSettings.company_size,
            industry: siteSettings.industry,
            products: parseJsonField(siteSettings.products, []),
            services: parseJsonField(siteSettings.services, []),
            swot: parseJsonField(siteSettings.swot, {
              strengths: '',
              weaknesses: '',
              opportunities: '',
              threats: ''
            }),
            locations: parseJsonField(siteSettings.locations, []),
            marketing_budget: parseJsonField(siteSettings.marketing_budget, {
              total: 0,
              available: 0
            }),
            marketing_channels: parseJsonField(siteSettings.marketing_channels, []),
            social_media: parseJsonField(siteSettings.social_media, []),
            target_keywords: parseJsonField(siteSettings.target_keywords, []),
            content_calendar: parseJsonField(siteSettings.content_calendar, []),
            tracking: parseJsonField(siteSettings.tracking, {
              track_visitors: false,
              track_actions: false,
              record_screen: false
            }),
            tracking_code: siteSettings.tracking_code,
            analytics_provider: siteSettings.analytics_provider,
            analytics_id: siteSettings.analytics_id,
            team_members: parseJsonField(siteSettings.team_members, []),
            team_roles: parseJsonField(siteSettings.team_roles, []),
            org_structure: parseJsonField(siteSettings.org_structure, {}),
            created_at: siteSettings.created_at,
            updated_at: siteSettings.updated_at
          } : undefined
        }
      })
      
      console.log("Sites with settings:", sitesWithData)
      setSites(sitesWithData as Site[])
      
      // Si hay sitios, intentamos restaurar el sitio guardado o usar el primero
      if (sitesWithData.length > 0) {
        const savedSiteId = getLocalStorage("currentSiteId")
        console.log("Saved site ID from localStorage:", savedSiteId)
        
        const savedSite = savedSiteId ? sitesWithData.find((site: any) => site.id === savedSiteId) : null
        console.log("Found saved site:", savedSite ? "yes" : "no")
        
        // Si el sitio guardado existe en los datos actuales, lo usamos
        if (savedSite) {
          console.log("Setting saved site as current:", savedSite.name)
          handleSetCurrentSite(savedSite)
        } 
        // Si no hay sitio guardado o no se encuentra, usamos el primero
        else {
          console.log("No saved site found, using first site:", sitesWithData[0].name)
          handleSetCurrentSite(sitesWithData[0])
          setLocalStorage("currentSiteId", sitesWithData[0].id)
        }
      } else {
        console.log("No sites found for this user")
        setCurrentSite(null)
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

    // Suscribirse a cambios en la tabla sites
    const subscription = supabaseRef.current
      .channel('table-db-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'sites' 
      }, (payload: { eventType: string; new: any; old: any }) => {
        // Recargar sitios solo si hay cambios relevantes
        if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
          loadSites()
        } else if (payload.eventType === 'UPDATE') {
          // Para actualizaciones, solo recargamos si es el sitio actual
          const newRecord = payload.new as Site
          if (currentSite?.id === newRecord.id) {
            loadSites()
          }
        }
      })
      .subscribe()
    
    return () => {
      try {
        subscription.unsubscribe()
      } catch (error) {
        console.error("Error unsubscribing from channels:", error)
      }
    }
  }, [isInitialized, currentSite?.id, isMounted])
  
  // Guardar el sitio seleccionado en localStorage cuando cambie
  const handleSetCurrentSite = (site: Site) => {
    setCurrentSite(site)
    
    // Solo guardar si es un sitio válido y no es el 'default'
    if (site && site.id) {
      // Guardar el ID directamente - nuestra función setLocalStorage ya maneja la limpieza
      console.log(`Estableciendo sitio actual: ${site.name} (${site.id})`)
      setLocalStorage("currentSiteId", site.id)
    }
  }

  // Actualizar un sitio en Supabase
  const handleUpdateSite = async (site: Site) => {
    if (!supabaseRef.current) return Promise.reject(new Error("Supabase client not initialized"))
    
    try {
      setError(null)
      
      console.log("Updating site data:", site);
      
      // Extract settings from site object to update separately
      const { settings, ...siteData } = site;
      
      // Ensure tracking data is properly formatted
      const trackingData = siteData.tracking ? {
        track_visitors: !!siteData.tracking.track_visitors,
        track_actions: !!siteData.tracking.track_actions,
        record_screen: !!siteData.tracking.record_screen
      } : null;
      
      console.log("Tracking data to save:", trackingData);
      
      // Update the site record
      const { error } = await supabaseRef.current
        .from('sites')
        .update({
          name: siteData.name,
          url: siteData.url,
          description: siteData.description,
          logo_url: siteData.logo_url,
          resource_urls: siteData.resource_urls,
          competitors: siteData.competitors,
          focus_mode: siteData.focusMode || siteData.focus_mode,
          tracking: trackingData,
          updated_at: new Date().toISOString()
        })
        .eq('id', site.id)
      
      if (error) throw error
      
      // If settings provided, update them as well
      if (settings) {
        await handleUpdateSettings(site.id, settings)
      }
      
      await loadSites() // Reload the sites to get updated data
      
    } catch (err) {
      console.error("Error updating site:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    }
  }
  
  // Crear un nuevo sitio
  const handleCreateSite = async (newSite: Omit<Site, 'id' | 'created_at' | 'updated_at'>): Promise<Site> => {
    if (!supabaseRef.current) return Promise.reject(new Error("Supabase client not initialized"))
    
    try {
      setError(null)
      
      const { data: { session } } = await supabaseRef.current.auth.getSession()
      
      if (!session) {
        throw new Error("No active session")
      }
      
      const now = new Date().toISOString()
      const { data, error } = await supabaseRef.current
        .from('sites')
        .insert({
          name: newSite.name,
          url: newSite.url,
          description: newSite.description,
          logo_url: newSite.logo_url,
          resource_urls: newSite.resource_urls,
          competitors: newSite.competitors || null,
          focus_mode: newSite.focusMode || 50,
          user_id: session.user.id,
          created_at: now,
          updated_at: now
        })
        .select()
      
      if (error) throw error
      if (!data || data.length === 0) throw new Error("Could not create site")
      
      const createdSite = {
        ...data[0],
        focusMode: newSite.focusMode || 50
      } as Site
      
      // Guardar focusMode en localStorage
      setLocalStorage(`site_${createdSite.id}_focusMode`, createdSite.focusMode)
      
      await loadSites() // Recargar los sitios
      
      // Si es el primer sitio, lo establecemos como actual
      if (sites.length === 0) {
        handleSetCurrentSite(createdSite)
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
        if (newCurrentSite) handleSetCurrentSite(newCurrentSite)
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
    if (!supabaseRef.current) return Promise.reject(new Error("Supabase client not initialized"))
    
    try {
      console.log("Updating settings for site:", siteId)
      console.log("Raw settings data received:", settings)
      
      // Format the settings data to ensure it's properly saved
      const formattedSettings: Record<string, any> = {
        site_id: siteId,
        updated_at: new Date().toISOString()
      };
      
      // Copy over all primitive fields directly
      Object.entries(settings).forEach(([key, value]) => {
        if (key === 'id' || key === 'site_id' || key === 'created_at' || key === 'updated_at') {
          if (key === 'id') formattedSettings[key] = value;
          // Skip other special fields as they're handled separately
          return;
        }
        
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
          formattedSettings[key] = value;
        }
      });
      
      // Format all object/array fields
      if (settings.products !== undefined) {
        formattedSettings.products = Array.isArray(settings.products) ? settings.products : [];
      }
      
      if (settings.services !== undefined) {
        formattedSettings.services = Array.isArray(settings.services) ? settings.services : [];
      }
      
      if (settings.swot !== undefined) {
        formattedSettings.swot = settings.swot || {
          strengths: "",
          weaknesses: "",
          opportunities: "",
          threats: ""
        };
      }
      
      if (settings.locations !== undefined) {
        formattedSettings.locations = Array.isArray(settings.locations) ? settings.locations : [];
      }
      
      if (settings.marketing_budget !== undefined) {
        formattedSettings.marketing_budget = settings.marketing_budget || {
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
      
      if (settings.target_keywords !== undefined) {
        formattedSettings.target_keywords = Array.isArray(settings.target_keywords) ? settings.target_keywords : [];
      }
      
      if (settings.content_calendar !== undefined) {
        formattedSettings.content_calendar = Array.isArray(settings.content_calendar) ? settings.content_calendar : [];
      }
      
      if (settings.team_members !== undefined) {
        formattedSettings.team_members = Array.isArray(settings.team_members) ? settings.team_members : [];
      }
      
      if (settings.team_roles !== undefined) {
        formattedSettings.team_roles = Array.isArray(settings.team_roles) ? settings.team_roles : [];
      }
      
      if (settings.org_structure !== undefined) {
        formattedSettings.org_structure = settings.org_structure || {};
      }
      
      console.log("Formatted settings data to save:", formattedSettings);
      
      // Use upsert operation
      const { error } = await supabaseRef.current
        .from('settings')
        .upsert(formattedSettings, { 
          onConflict: 'site_id',
          ignoreDuplicates: false
        })
      
      if (error) {
        console.error("Error in upsert operation:", error)
        throw error
      }
      
      console.log("Settings updated successfully")
      
      // Reload sites to get updated data
      await loadSites()
      
    } catch (err) {
      console.error("Error updating settings:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
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