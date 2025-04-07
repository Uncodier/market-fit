"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/types/database.types"

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
  tracking?: {
    track_visitors: boolean
    track_actions: boolean
    record_screen: boolean
  }
  billing?: {
    plan: "free" | "starter" | "professional" | "enterprise"
    card_number?: string
    card_expiry?: string
    card_cvc?: string
    card_name?: string
    billing_address?: string
    billing_city?: string
    billing_postal_code?: string
    billing_country?: string
    auto_renew: boolean
  }
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
      const { data, error } = await supabaseRef.current
        .from('sites')
        .select('*')
        .eq('user_id', session.user.id)
      
      if (error) {
        console.error("Error fetching sites:", error)
        console.error("Error details:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        throw error
      }
      
      console.log("Raw sites data:", data)
      console.log("Sites fetched successfully:", data?.length || 0, "sites found")
      const siteData = data as Site[]
      
      // Cargar focusMode desde localStorage o usar focus_mode de la base de datos
      const sitesWithFocusMode = siteData.map(site => ({
        ...site,
        focusMode: getLocalStorage(`site_${site.id}_focusMode`, site.focus_mode || 50)
      }))
      
      setSites(sitesWithFocusMode)
      
      // Si hay sitios, intentamos restaurar el sitio guardado o usar el primero
      if (sitesWithFocusMode.length > 0) {
        const savedSiteId = getLocalStorage("currentSiteId")
        console.log("Saved site ID from localStorage:", savedSiteId)
        
        const savedSite = savedSiteId ? sitesWithFocusMode.find(site => site.id === savedSiteId) : null
        console.log("Found saved site:", savedSite ? "yes" : "no")
        
        // Si el sitio guardado existe en los datos actuales, lo usamos
        if (savedSite) {
          console.log("Setting saved site as current:", savedSite.name)
          handleSetCurrentSite(savedSite)
        } 
        // Si no hay sitio guardado o no se encuentra, usamos el primero
        else {
          console.log("No saved site found, using first site:", sitesWithFocusMode[0].name)
          handleSetCurrentSite(sitesWithFocusMode[0])
          setLocalStorage("currentSiteId", sitesWithFocusMode[0].id)
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
  const handleUpdateSite = async (updatedSite: Site) => {
    if (!supabaseRef.current) return Promise.reject(new Error("Supabase client not initialized"))
    
    try {
      setError(null)
      
      // Primero actualizamos el estado local
      const updatedSiteWithTimestamp = {
        ...updatedSite,
        updated_at: new Date().toISOString()
      }

      // Preparamos los datos para Supabase (omitiendo campos que no están en la tabla)
      const updateData = {
        name: updatedSite.name,
        url: updatedSite.url,
        description: updatedSite.description,
        logo_url: updatedSite.logo_url,
        resource_urls: updatedSite.resource_urls,
        competitors: updatedSite.competitors,
        focus_mode: updatedSite.focusMode,
        updated_at: updatedSiteWithTimestamp.updated_at
      }
      
      // Actualizamos en Supabase
      const { error } = await supabaseRef.current
        .from('sites')
        .update(updateData)
        .eq('id', updatedSite.id)
      
      if (error) throw error

      // Si no hay error, guardamos el focusMode en localStorage
      setLocalStorage(`site_${updatedSite.id}_focusMode`, updatedSite.focusMode)
      
      // Si el sitio actualizado es el actual, actualizamos el estado
      if (currentSite?.id === updatedSite.id) {
        handleSetCurrentSite(updatedSiteWithTimestamp)
      }

      // Actualizamos la lista de sitios
      setSites(prevSites => 
        prevSites.map(site => 
          site.id === updatedSite.id ? updatedSiteWithTimestamp : site
        )
      )

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
    refreshSites: loadSites
  }
  
  return (
    <SiteContext.Provider value={value}>
      {children}
    </SiteContext.Provider>
  )
} 