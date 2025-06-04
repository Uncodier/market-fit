"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { usePathname } from 'next/navigation'

interface WidgetContextType {
  shouldExecuteWidgets: boolean
  currentRoute: string
}

const WidgetContext = createContext<WidgetContextType | undefined>(undefined)

export function useWidgetContext() {
  const context = useContext(WidgetContext)
  
  // Handle SSR case - during server-side rendering, disable widgets
  if (typeof window === 'undefined') {
    return {
      shouldExecuteWidgets: false,
      currentRoute: ''
    }
  }
  
  if (context === undefined) {
    // Fallback for when provider is not available (shouldn't happen in normal flow)
    console.warn("useWidgetContext used outside of WidgetProvider, falling back to disabled state")
    return {
      shouldExecuteWidgets: false,
      currentRoute: ''
    }
  }
  
  return context
}

interface WidgetProviderProps {
  children: ReactNode
}

export function WidgetProvider({ children }: WidgetProviderProps) {
  const pathname = usePathname()
  const [shouldExecuteWidgets, setShouldExecuteWidgets] = useState(false)
  const [isClient, setIsClient] = useState(false)

  // Track when we're on the client side
  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    // Only enable widgets on client side and in dashboard routes
    if (isClient) {
      const isDashboardRoute = pathname?.includes('/dashboard') || pathname === '/'
      setShouldExecuteWidgets(isDashboardRoute)
      
      console.log(`[WidgetContext] Route: ${pathname}, Widgets enabled: ${isDashboardRoute}`)
    }
  }, [pathname, isClient])

  return (
    <WidgetContext.Provider value={{ 
      shouldExecuteWidgets, 
      currentRoute: pathname || '' 
    }}>
      {children}
    </WidgetContext.Provider>
  )
} 