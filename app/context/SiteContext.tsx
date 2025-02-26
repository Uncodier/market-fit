"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

// Definición de la interfaz Site
export interface Site {
  id: string
  name: string
  domain: string
}

// Sitios de ejemplo (esto debería venir de una API en producción)
const sampleSites = [
  {
    id: "1",
    name: "Market Fit App",
    domain: "app.marketfit.com"
  },
  {
    id: "2",
    name: "Market Fit Blog",
    domain: "blog.marketfit.com"
  },
  {
    id: "3",
    name: "Market Fit Docs",
    domain: "docs.marketfit.com"
  }
]

// Interfaz del contexto
interface SiteContextType {
  sites: Site[]
  currentSite: Site
  setCurrentSite: (site: Site) => void
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

// Componente proveedor
export function SiteProvider({ children }: SiteProviderProps) {
  // Estado para el sitio actual
  const [currentSite, setCurrentSite] = useState<Site>(sampleSites[0])
  const [sites] = useState<Site[]>(sampleSites)
  
  // Cargar el sitio seleccionado del localStorage al iniciar
  useEffect(() => {
    const savedSite = localStorage.getItem("currentSite")
    if (savedSite) {
      try {
        const parsedSite = JSON.parse(savedSite)
        // Verificar que el sitio guardado existe en la lista actual
        const siteExists = sites.some(site => site.id === parsedSite.id)
        if (siteExists) {
          setCurrentSite(parsedSite)
        }
      } catch (error) {
        console.error("Error al cargar el sitio guardado:", error)
      }
    }
  }, [sites])
  
  // Guardar el sitio seleccionado en localStorage cuando cambie
  const handleSetCurrentSite = (site: Site) => {
    setCurrentSite(site)
    localStorage.setItem("currentSite", JSON.stringify(site))
  }
  
  // Valor del contexto
  const value = {
    sites,
    currentSite,
    setCurrentSite: handleSetCurrentSite
  }
  
  return (
    <SiteContext.Provider value={value}>
      {children}
    </SiteContext.Provider>
  )
} 