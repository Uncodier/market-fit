"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { useOptionalSite } from "@/app/context/SiteContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { useAuth } from "@/app/hooks/use-auth"
import { isAdminScreenRole, isScreenBlocked } from "@/lib/auth/screen-access"
import { isRealSiteId } from "@/lib/demo-utils"
import type { SiteMemberRole } from "@/lib/permissions/types"

type ScreenAccessContextValue = {
  blockedScreens: string[]
  isSiteAdmin: boolean
  isReady: boolean
  canAccessNavKey: (key: string) => boolean
}

const ScreenAccessContext = createContext<ScreenAccessContextValue | null>(null)

export function ScreenAccessProvider({ children }: { children: ReactNode }) {
  const site = useOptionalSite()
  const permissions = useOptionalPermissions()
  const { user } = useAuth()
  const siteId = site?.currentSite?.id ?? null
  const [blockedScreens, setBlockedScreens] = useState<string[]>([])
  const [memberRole, setMemberRole] = useState<SiteMemberRole | null>(null)
  const [loadedSiteId, setLoadedSiteId] = useState<string | null>(null)

  const capabilityRole = permissions?.capabilities?.role ?? null
  const isOwner = !!permissions?.capabilities?.is_owner
  const isSiteAdmin = isOwner || isAdminScreenRole(capabilityRole) || isAdminScreenRole(memberRole)

  useEffect(() => {
    let cancelled = false
    setBlockedScreens([])
    setMemberRole(null)
    setLoadedSiteId(null)

    if (!siteId || !user?.id || !isRealSiteId(siteId)) {
      setLoadedSiteId(siteId)
      return
    }

    const supabase = createClient()
    supabase
      .from("site_members")
      .select("role, blocked_screens")
      .eq("site_id", siteId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setMemberRole((data?.role as SiteMemberRole) || null)
        setBlockedScreens(Array.isArray(data?.blocked_screens) ? data.blocked_screens : [])
        setLoadedSiteId(siteId)
      })
      .catch(() => {
        if (cancelled) return
        setLoadedSiteId(siteId)
      })

    return () => {
      cancelled = true
    }
  }, [siteId, user?.id])

  const canAccessNavKey = useCallback(
    (key: string) => !isScreenBlocked(isSiteAdmin ? "admin" : memberRole, blockedScreens, key),
    [blockedScreens, isSiteAdmin, memberRole]
  )

  const value = useMemo<ScreenAccessContextValue>(
    () => ({
      blockedScreens,
      isSiteAdmin,
      isReady: loadedSiteId === siteId,
      canAccessNavKey,
    }),
    [blockedScreens, canAccessNavKey, isSiteAdmin, loadedSiteId, siteId]
  )

  return (
    <ScreenAccessContext.Provider value={value}>
      {children}
    </ScreenAccessContext.Provider>
  )
}

export function useOptionalScreenAccess() {
  return useContext(ScreenAccessContext)
}

export function useScreenAccess() {
  const context = useContext(ScreenAccessContext)
  if (!context) {
    throw new Error("useScreenAccess must be used within a ScreenAccessProvider")
  }
  return context
}
