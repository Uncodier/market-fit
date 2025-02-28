"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
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
  currentSite: Site
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
    throw new Error("useSite debe ser usado dentro de un SiteProvider")
  }
  return context
}

// Props del proveedor
interface SiteProviderProps {
  children: ReactNode
}

// Sitio por defecto para casos donde no hay sitios
const defaultSite: Site = {
  id: "default",
  name: "Mi primer sitio",
  url: "",
  description: "",
  logo_url: null,
  user_id: "",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  resource_urls: [],
  competitors: [],
  focusMode: 50,
  focus_mode: 50
}

// Componente proveedor
export function SiteProvider({ children }: SiteProviderProps) {
  const [currentSite, setCurrentSite] = useState<Site | null>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const supabase = createClient()
  
  // Cargar sitios desde Supabase
  const loadSites = async () => {
    try {
      if (!isInitialized) setIsLoading(true)
      setError(null)
      
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        setIsLoading(false)
        return
      }
      
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .eq('user_id', session.user.id)
      
      if (error) throw error
      
      const siteData = data as Site[]
      
      // Cargar focusMode desde localStorage o usar focus_mode de la base de datos
      const sitesWithFocusMode = siteData.map(site => ({
        ...site,
        focusMode: Number(localStorage.getItem(`site_${site.id}_focusMode`)) || site.focus_mode || 50
      }))
      
      setSites(sitesWithFocusMode)
      
      // Si hay sitios, intentamos restaurar el sitio guardado o usar el primero
      if (sitesWithFocusMode.length > 0) {
        const savedSiteId = localStorage.getItem("currentSiteId")
        const savedSite = savedSiteId ? sitesWithFocusMode.find(site => site.id === savedSiteId) : null
        
        // Si el sitio guardado existe en los datos actuales, lo usamos
        if (savedSite) {
          handleSetCurrentSite(savedSite)
        } 
        // Si no hay sitio guardado o no se encuentra, usamos el primero
        else {
          handleSetCurrentSite(sitesWithFocusMode[0])
          localStorage.setItem("currentSiteId", sitesWithFocusMode[0].id)
        }
      } else {
        // Si no hay sitios, usamos el sitio por defecto
        handleSetCurrentSite(defaultSite)
        localStorage.removeItem("currentSiteId")
      }

      if (!isInitialized) {
        setIsInitialized(true)
      }
    } catch (err) {
      console.error("Error al cargar sitios:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoading(false)
    }
  }
  
  // Cargar sitios al iniciar el provider
  useEffect(() => {
    loadSites()
  }, [])

  // Efecto separado para manejar las suscripciones
  useEffect(() => {
    if (!isInitialized) return

    // Suscribirse a cambios en la tabla sites
    const subscription = supabase
      .channel('table-db-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'sites' 
      }, (payload) => {
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
      subscription.unsubscribe()
    }
  }, [isInitialized, currentSite?.id])
  
  // Guardar el sitio seleccionado en localStorage cuando cambie
  const handleSetCurrentSite = (site: Site) => {
    setCurrentSite(site)
    localStorage.setItem("currentSiteId", site.id)
  }

  // Actualizar un sitio en Supabase
  const handleUpdateSite = async (updatedSite: Site) => {
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
      const { error } = await supabase
        .from('sites')
        .update(updateData)
        .eq('id', updatedSite.id)
      
      if (error) throw error

      // Si no hay error, guardamos el focusMode en localStorage
      localStorage.setItem(`site_${updatedSite.id}_focusMode`, String(updatedSite.focusMode))
      
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
      console.error("Error al actualizar el sitio:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    }
  }
  
  // Crear un nuevo sitio
  const handleCreateSite = async (newSite: Omit<Site, 'id' | 'created_at' | 'updated_at'>): Promise<Site> => {
    try {
      setError(null)
      
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error("No hay sesión activa")
      }
      
      const now = new Date().toISOString()
      const { data, error } = await supabase
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
      if (!data || data.length === 0) throw new Error("No se pudo crear el sitio")
      
      const createdSite = {
        ...data[0],
        focusMode: newSite.focusMode || 50
      } as Site
      
      // Guardar focusMode en localStorage
      localStorage.setItem(`site_${createdSite.id}_focusMode`, String(createdSite.focusMode))
      
      await loadSites() // Recargar los sitios
      
      // Si es el primer sitio, lo establecemos como actual
      if (sites.length === 0) {
        handleSetCurrentSite(createdSite)
      }
      
      return createdSite
    } catch (err) {
      console.error("Error al crear el sitio:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    }
  }
  
  // Eliminar un sitio
  const handleDeleteSite = async (id: string) => {
    try {
      setError(null)
      
      const { error } = await supabase
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
      console.error("Error al eliminar el sitio:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    }
  }
  
  // Valor del contexto
  const value = {
    sites,
    currentSite: currentSite || defaultSite,
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