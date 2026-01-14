"use client"

import { createContext, useContext, ReactNode, useState, useEffect, useRef } from 'react'

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
  const hasAutoCollapsedRef = useRef(false)
  const userManuallyExpandedRef = useRef(false)
  const previousWidthRef = useRef<number | null>(null)

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

  // Auto-collapse when screen width is less than 1400px (once per threshold crossing)
  useEffect(() => {
    const handleResize = () => {
      const currentWidth = window.innerWidth
      const threshold = 1400
      const previousWidth = previousWidthRef.current

      // Initialize previous width on first run
      if (previousWidth === null) {
        previousWidthRef.current = currentWidth
        return
      }

      // Check if we're crossing the threshold from above to below
      const crossingBelow = previousWidth >= threshold && currentWidth < threshold
      
      // Check if we're crossing the threshold from below to above
      const crossingAbove = previousWidth < threshold && currentWidth >= threshold

      // If crossing from above to below, auto-collapse (only once per crossing)
      if (crossingBelow && !hasAutoCollapsedRef.current && !userManuallyExpandedRef.current) {
        setIsLayoutCollapsed(true)
        hasAutoCollapsedRef.current = true
      }

      // If crossing from below to above, reset the auto-collapse flag
      if (crossingAbove) {
        hasAutoCollapsedRef.current = false
        userManuallyExpandedRef.current = false
      }

      previousWidthRef.current = currentWidth
    }

    // Check initial width on mount
    if (typeof window !== 'undefined') {
      const initialWidth = window.innerWidth
      previousWidthRef.current = initialWidth
      
      if (initialWidth < 1400 && !isLayoutCollapsed) {
        setIsLayoutCollapsed(true)
        hasAutoCollapsedRef.current = true
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Track manual user expansion after auto-collapse
  useEffect(() => {
    // If user manually expands after auto-collapse, mark it
    if (hasAutoCollapsedRef.current && !isLayoutCollapsed) {
      userManuallyExpandedRef.current = true
    }
  }, [isLayoutCollapsed])

  return (
    <LayoutContext.Provider value={{ isLayoutCollapsed, setIsLayoutCollapsed }}>
      {children}
    </LayoutContext.Provider>
  )
} 