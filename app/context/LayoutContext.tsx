"use client"

import { createContext, useContext, ReactNode, useState, useEffect } from 'react'
import {
  nextWorkspaceSidebarMode, readWorkspaceSidebarMode, WORKSPACE_SIDEBAR_MODE_KEY,
  WORKSPACE_SIDEBAR_WIDTH, type WorkspaceSidebarMode,
} from '@/app/components/navigation/workspace-sidebar-mode'

export type RobotsViewMode = "agent" | "imprenta" | "workflow"

interface LayoutContextType {
  isLayoutCollapsed: boolean
  sidebarMode: WorkspaceSidebarMode
  sidebarWidth: number
  cycleSidebarMode: () => void
  /** Agents vs Imprenta vs Workflow canvas */
  robotsViewMode: RobotsViewMode
  setRobotsViewMode: (mode: RobotsViewMode) => void
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined)

interface LayoutProviderProps {
  children: ReactNode
}

export function useLayout() {
  const context = useContext(LayoutContext)
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider')
  }
  return context
}

function readInitialRobotsViewMode(): RobotsViewMode {
  if (typeof window === "undefined") return "agent"
  try {
    const path = window.location.pathname
    if (path === "/robots" || path.startsWith("/robots/")) {
      const sp = new URLSearchParams(window.location.search)
      if (sp.get("mode") === "imprenta") return "imprenta"
      if (sp.get("mode") === "workflow") return "workflow"
    }
  } catch {
    /* ignore */
  }
  return "agent"
}

export function LayoutProvider({ children }: LayoutProviderProps) {
  const [savedSidebarMode, setSidebarMode] = useState<WorkspaceSidebarMode | null>(null)
  const sidebarMode = savedSidebarMode ?? "hidden"
  const [robotsViewMode, setRobotsViewMode] = useState<RobotsViewMode>(readInitialRobotsViewMode)

  useEffect(() => {
    let storedMode: WorkspaceSidebarMode = "hidden"
    try {
      storedMode = readWorkspaceSidebarMode(localStorage.getItem(WORKSPACE_SIDEBAR_MODE_KEY))
    } catch {
      // Fall back to auto-hide when browser storage is unavailable.
    }
    // Keep the server and hydration render hidden, then restore the browser preference.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarMode((current) => current ?? storedMode)
  }, [])

  useEffect(() => {
    if (savedSidebarMode === null) return
    try {
      localStorage.setItem(WORKSPACE_SIDEBAR_MODE_KEY, savedSidebarMode)
    } catch {
      // The in-memory preference still works when browser storage is unavailable.
    }
  }, [savedSidebarMode])

  return (
    <LayoutContext.Provider
      value={{
        isLayoutCollapsed: sidebarMode !== "expanded",
        sidebarMode,
        sidebarWidth: WORKSPACE_SIDEBAR_WIDTH[sidebarMode],
        cycleSidebarMode: () => setSidebarMode((current) => nextWorkspaceSidebarMode(current ?? "hidden")),
        robotsViewMode,
        setRobotsViewMode,
      }}
    >
      {children}
    </LayoutContext.Provider>
  )
} 