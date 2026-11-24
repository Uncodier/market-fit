"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useOptionalSite } from "@/app/context/SiteContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { isAdminScreenRole, isScreenBlocked } from "@/lib/auth/screen-access"
import type { AllowedWorkspaceListScope, ScreenScope } from '@/lib/permissions/workspace-screen-scope'
import type { WorkspaceRequestScope } from './site-types'
import { useWorkspaceAccessSnapshot, WorkspaceAccessSnapshot } from './WorkspaceAccessSnapshot'

type ScreenAccessContextValue = {
  blockedScreens: string[]
  isSiteAdmin: boolean
  isReady: boolean
  canAccessNavKey: (key: string) => boolean
  screenScopeStatus: 'loading' | ScreenScope['status']
  verifiedListScope?: WorkspaceRequestScope
  /** Verified once per selection/invalidation. Callers still check their own screen key. */
  verifiedWorkspaceLists?: AllowedWorkspaceListScope
  legacyListAllowed: boolean
  legacyWorkspaceListsAllowed: boolean
  retryScreenScope: () => void
}

const ScreenAccessContext = createContext<ScreenAccessContextValue | null>(null)

export function ScreenAccessProvider({ children }: { children: ReactNode }) {
  const shared = useWorkspaceAccessSnapshot()
  // Also support standalone consumers; the full workspace already has a single
  // snapshot above both providers, so never schedule a second read here.
  return shared ? <ScreenProjection>{children}</ScreenProjection> :
    <WorkspaceAccessSnapshot><ScreenProjection>{children}</ScreenProjection></WorkspaceAccessSnapshot>
}

function ScreenProjection({ children }: { children: ReactNode }) {
  const site = useOptionalSite()
  const permissions = useOptionalPermissions()
  const { actor, siteId, read, retry: retryScreenScope } = useWorkspaceAccessSnapshot()!
  const current = site?.currentSite?.id
  const value = useMemo<ScreenAccessContextValue>(() => {
    const loaded = read?.status === 'ready' || read?.status === 'legacy' ? read : null
    const demo = !!current?.startsWith('demo-')
    const role = loaded?.role ?? null
    const blockedScreens = loaded?.blockedScreens ?? []
    // Capabilities are for the old membership-only navigation projection. A
    // missing/failed/mismatched read must never promote an independent list.
    const isSiteAdmin = isAdminScreenRole(role) || ((demo || loaded?.status === 'legacy') &&
      permissions?.siteId === current && isAdminScreenRole(permissions?.capabilities?.role))
    const canAccessNavKey = (key: string) => !isScreenBlocked(isSiteAdmin ? 'admin' : role, blockedScreens, key)
    const verifiedWorkspaceLists = actor && siteId && loaded?.status === 'ready' && !loaded.locationRestricted
      ? { actorId: actor, siteId, blockedScreens, isAdmin: isAdminScreenRole(loaded.role) } : undefined
    const verifiedListScope = verifiedWorkspaceLists && canAccessNavKey('chat') ? verifiedWorkspaceLists : undefined
    // A cached selector entry and an absent membership row cannot establish
    // legacy access. Require the existing server-derived capability for this
    // site as well; only a verified owner may have no site_members row.
    const capability = permissions?.siteId === siteId ? permissions?.capabilities : null
    const legacyWorkspaceListsAllowed = loaded?.status === 'legacy' && capability?.select === true &&
      (capability.role === 'owner' || (!!role && capability.role === role))
    const legacyListAllowed = legacyWorkspaceListsAllowed && canAccessNavKey('chat')
    return { blockedScreens, isSiteAdmin, isReady: demo || !!loaded, canAccessNavKey, verifiedListScope, verifiedWorkspaceLists,
      screenScopeStatus: read?.status ?? 'loading', legacyWorkspaceListsAllowed, legacyListAllowed, retryScreenScope }
  }, [read, actor, siteId, current, permissions, retryScreenScope])

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
