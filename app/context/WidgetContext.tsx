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
  if (context === undefined) {
    throw new Error("useWidgetContext must be used within a WidgetProvider")
  }
  return context
}

interface WidgetProviderProps {
  children: ReactNode
}

export function WidgetProvider({ children }: WidgetProviderProps) {
  const pathname = usePathname()
  const [shouldExecuteWidgets, setShouldExecuteWidgets] = useState(false)

  useEffect(() => {
    // Only allow widget execution in dashboard routes
    const isDashboardRoute = pathname?.includes('/dashboard') || pathname === '/'
    setShouldExecuteWidgets(isDashboardRoute)
    
    console.log(`[WidgetContext] Route: ${pathname}, Widgets enabled: ${isDashboardRoute}`)
  }, [pathname])

  return (
    <WidgetContext.Provider value={{ 
      shouldExecuteWidgets, 
      currentRoute: pathname || '' 
    }}>
      {children}
    </WidgetContext.Provider>
  )
} 