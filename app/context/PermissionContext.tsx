"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { useOptionalSite } from "@/app/context/SiteContext"
import {
  commandAllowed,
  capabilitiesFromRole,
  parseCapabilities,
  setPermissionStore,
} from "@/lib/permissions/capabilities"
import type { PermissionCommand, SiteCapabilities } from "@/lib/permissions/types"
import { useLocationPermissionRevision } from '@/app/hooks/use-location-permission-revision'
import { useWorkspaceAccessSnapshot } from './WorkspaceAccessSnapshot'

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
  useLocationPermissionRevision(siteId)
  const snapshot = useWorkspaceAccessSnapshot()
  const legacy = !snapshot || siteId?.startsWith('demo-') || (snapshot.siteId === siteId && snapshot.read?.status === 'legacy')
  const source = useMemo(() => ({ siteId, legacy: !!legacy, read: snapshot?.read }), [siteId, legacy, snapshot?.read])
  const [loaded, setLoaded] = useState<{ source: object; capabilities: SiteCapabilities | null } | null>(null)
  const confirmed = snapshot?.siteId === siteId && snapshot?.read?.status === 'ready' ? snapshot.read : null
  const capabilities = useMemo(() => source.legacy ? (loaded?.source === source ? loaded.capabilities : null)
    : capabilitiesFromRole(confirmed?.role ?? null), [confirmed, source, loaded])

  useEffect(() => {
    let cancelled = false
    if (!source.siteId || !source.legacy) return
    fetchCapabilities(source.siteId).then((next) => {
      if (cancelled) return
      setLoaded({ source, capabilities: next })
    })
    return () => { cancelled = true }
  }, [source])
  useEffect(() => {
    setPermissionStore({ siteId, capabilities, loaded: !siteId || !!capabilities })
    return () => setPermissionStore({ siteId: null, capabilities: null, loaded: false })
  }, [siteId, capabilities])

  const value = useMemo<PermissionContextValue>(() => {
    const can = (command: PermissionCommand) => {
      if (!siteId || !capabilities) return true
      return commandAllowed(capabilities, command)
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
