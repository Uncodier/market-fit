"use client"

import { useSite } from '@/app/context/SiteContext'
import { useAuth } from '@/app/hooks/use-auth'
import { useOptionalScreenAccess } from '@/app/context/ScreenAccessContext'
import { useWorkspaceAccessSnapshot } from '@/app/context/WorkspaceAccessSnapshot'
import type { WorkspaceRequestScope } from '@/app/context/site-types'

type NotificationScope =
  | { status: 'ready' | 'paused'; target: WorkspaceRequestScope; proof: object }
  | { status: 'checking' | 'missing' | 'denied' }
  | { status: 'settings-unavailable'; retry: () => void }
  | { status: 'unavailable'; retry?: () => void }

/** Only a hydrated matching selection identifies the intended inbox. The GET
 * independently authenticates the caller and authorizes this site on every read. */
export function useNotificationScope(): NotificationScope {
  const { currentSite, requestScope, workspaceAccessLost, isLoading: siteLoading, error, refreshSites } = useSite()
  const { user, isLoading: authLoading } = useAuth()
  const screen = useOptionalScreenAccess()
  const snapshot = useWorkspaceAccessSnapshot()
  if (authLoading) return { status: 'checking' }
  if (!user || user.is_anonymous || workspaceAccessLost || currentSite?.id.startsWith('demo-')) return { status: 'denied' }
  if (requestScope && (requestScope.actorId !== user.id || (currentSite && requestScope.siteId !== currentSite.id))) {
    return { status: 'checking' }
  }
  if (requestScope && screen?.screenScopeStatus === 'denied') return { status: 'denied' }
  if (!currentSite && error && !siteLoading) {
    return { status: 'settings-unavailable', retry: () => void refreshSites({ recoverMissingList: true }) }
  }
  if (!requestScope && !currentSite && !siteLoading) return { status: 'missing' }
  if (!requestScope) return { status: 'checking' }
  if (!screen || screen.screenScopeStatus === 'unavailable') return { status: 'unavailable', retry: screen?.retryScreenScope }
  if (screen.screenScopeStatus === 'ready' && !screen.verifiedWorkspaceLists) return { status: 'denied' } // Location restricted
  if (!currentSite || screen.screenScopeStatus === 'loading') return { status: 'checking' }
  const proof = screen.verifiedWorkspaceLists
  const allowed = screen.screenScopeStatus === 'legacy' ? screen.legacyWorkspaceListsAllowed
    : screen.screenScopeStatus === 'ready' && proof?.actorId === user.id && proof.siteId === currentSite.id
  if (!allowed) return { status: 'unavailable', retry: screen.retryScreenScope }
  if (!snapshot?.read || snapshot.read.status !== screen.screenScopeStatus || snapshot.actor !== user.id || snapshot.siteId !== currentSite.id) {
    return { status: 'checking' }
  }
  return { status: siteLoading ? 'paused' : 'ready', target: requestScope, proof: snapshot.read }
}