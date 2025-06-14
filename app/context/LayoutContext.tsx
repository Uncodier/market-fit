"use client"

import { createContext, useContext, ReactNode, useState, useEffect } from 'react'

interface LayoutContextType {
  isLayoutCollapsed: boolean
  setIsLayoutCollapsed: (collapsed: boolean) => void
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined)

interface LayoutProviderProps {
  children: ReactNode
  isLayoutCollapsed?: boolean
}

export function useLayout() {
  const context = useContext(LayoutContext)
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider')
  }
  return context
}

export function LayoutProvider({ children, isLayoutCollapsed: initialIsCollapsed = false }: LayoutProviderProps) {
  const [isLayoutCollapsed, setIsLayoutCollapsed] = useState(initialIsCollapsed)

  // Sincronizar con localStorage al montar
  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    if (saved !== null) {
      try {
        const parsedValue = JSON.parse(saved)
        setIsLayoutCollapsed(parsedValue)
      } catch (error) {
        console.error("Error parsing sidebar collapsed state:", error)
      }
    }
  }, [])

  // Guardar cambios en localStorage
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isLayoutCollapsed))
  }, [isLayoutCollapsed])

  return (
    <LayoutContext.Provider value={{ isLayoutCollapsed, setIsLayoutCollapsed }}>
      {children}
    </LayoutContext.Provider>
  )
} 