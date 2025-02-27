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
}

export interface ResourceUrl {
  key: string
  url: string
}

// Interfaz del contexto
interface SiteContextType {
  sites: Site[]
  currentSite: Site
  isLoading: boolean
  error: Error | null
  setCurrentSite: (site: Site) => void
  updateSite: (site: Site) => Promise<void>
  createSite: (site: Omit<Site, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
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
  resource_urls: []
}

// Componente proveedor
export function SiteProvider({ children }: SiteProviderProps) {
  const [currentSite, setCurrentSite] = useState<Site>(defaultSite)
  const [sites, setSites] = useState<Site[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabase = createClient()
  
  // Cargar sitios desde Supabase
  const loadSites = async () => {
    try {
      setIsLoading(true)
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
      setSites(siteData)
      
      // Si hay sitios y no hay uno guardado, establecemos el primero como actual
      if (siteData.length > 0) {
        const savedSiteId = localStorage.getItem("currentSiteId")
        const savedSite = savedSiteId ? siteData.find(site => site.id === savedSiteId) : null
        handleSetCurrentSite(savedSite || siteData[0])
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
    
    // Suscribirse a cambios en la tabla sites
    const subscription = supabase
      .channel('table-db-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'sites' 
      }, () => {
        loadSites()
      })
      .subscribe()
    
    return () => {
      subscription.unsubscribe()
    }
  }, [])
  
  // Guardar el sitio seleccionado en localStorage cuando cambie
  const handleSetCurrentSite = (site: Site) => {
    setCurrentSite(site)
    localStorage.setItem("currentSiteId", site.id)
  }

  // Actualizar un sitio en Supabase
  const handleUpdateSite = async (updatedSite: Site) => {
    try {
      setError(null)
      
      const { error } = await supabase
        .from('sites')
        .update({ 
          name: updatedSite.name,
          url: updatedSite.url,
          description: updatedSite.description,
          logo_url: updatedSite.logo_url,
          resource_urls: updatedSite.resource_urls,
          updated_at: new Date().toISOString()
        })
        .eq('id', updatedSite.id)
      
      if (error) throw error
      
      await loadSites() // Recargar los sitios
      
      // Si el sitio actualizado es el actual, actualizamos también el estado
      if (currentSite.id === updatedSite.id) {
        handleSetCurrentSite({
          ...updatedSite,
          updated_at: new Date().toISOString()
        })
      }
    } catch (err) {
      console.error("Error al actualizar el sitio:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
      throw err
    }
  }
  
  // Crear un nuevo sitio
  const handleCreateSite = async (newSite: Omit<Site, 'id' | 'created_at' | 'updated_at'>) => {
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
          ...newSite,
          user_id: session.user.id,
          created_at: now,
          updated_at: now
        })
        .select()
      
      if (error) throw error
      
      await loadSites() // Recargar los sitios
      
      // Si es el primer sitio, lo establecemos como actual
      if (sites.length === 0 && data && data.length > 0) {
        handleSetCurrentSite(data[0] as Site)
      }
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
      if (currentSite.id === id && sites.length > 0) {
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
    currentSite,
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