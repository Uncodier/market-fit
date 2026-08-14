"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { useOptionalSite } from "@/app/context/SiteContext"
import {
  parseCapabilities,
  setPermissionStore,
} from "@/lib/permissions/capabilities"
import type { PermissionCommand, SiteCapabilities } from "@/lib/permissions/types"

type PermissionContextValue = {
  siteId: string | null
  capabilities: SiteCapabilities | null
  can: (command: PermissionCommand) => boolean
  isViewOnly: boolean
}

const PermissionContext = createContext<PermissionContextValue | null>(null)

async function fetchCapabilities(siteId: string): Promise<SiteCapabilities | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc("get_my_site_capabilities", {
      p_site_id: siteId,
    })
    if (error) return null
    return parseCapabilities(data)
  } catch {
    return null
  }
}

export function PermissionProvider({ children }: { children: ReactNode }) {
  const site = useOptionalSite()
  const siteId = site?.currentSite?.id ?? null
  const [capabilities, setCapabilities] = useState<SiteCapabilities | null>(null)

  useEffect(() => {
    let cancelled = false
    setPermissionStore({ siteId, capabilities: null, loaded: false })
    setCapabilities(null)

    if (!siteId) {
      setPermissionStore({ siteId: null, capabilities: null, loaded: true })
      return
    }

    fetchCapabilities(siteId).then((next) => {
      if (cancelled) return
      setCapabilities(next)
      setPermissionStore({ siteId, capabilities: next, loaded: true })
    })

    return () => {
      cancelled = true
    }
  }, [siteId])

  const value = useMemo<PermissionContextValue>(() => {
    const can = (command: PermissionCommand) => {
      if (!siteId || !capabilities) return true
      return !!capabilities[command]
    }
    return {
      siteId,
      capabilities,
      can,
      isViewOnly: !!capabilities && !capabilities.insert && !capabilities.update,
    }
  }, [siteId, capabilities])

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  )
}

export function useOptionalPermissions() {
  return useContext(PermissionContext)
}

export function usePermissions() {
  const context = useContext(PermissionContext)
  if (!context) {
    throw new Error("usePermissions must be used within a PermissionProvider")
  }
  return context
}
