"use client"

import { createContext, useContext, ReactNode } from 'react'

interface LayoutContextType {
  isLayoutCollapsed: boolean
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined)

export function useLayout() {
  const context = useContext(LayoutContext)
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider')
  }
  return context
}

interface LayoutProviderProps {
  children: ReactNode
  isLayoutCollapsed: boolean
}

export function LayoutProvider({ children, isLayoutCollapsed }: LayoutProviderProps) {
  return (
    <LayoutContext.Provider value={{ isLayoutCollapsed }}>
      {children}
    </LayoutContext.Provider>
  )
} 