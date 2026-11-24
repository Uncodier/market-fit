"use client"

import { useSite } from '@/app/context/SiteContext'
import { useAuth } from '@/app/hooks/use-auth'
import { useOptionalScreenAccess } from '@/app/context/ScreenAccessContext'
import type { WorkspaceRequestScope } from '@/app/context/site-types'

type NotificationScope =
  | { status: 'ready'; target: WorkspaceRequestScope }
  | { status: 'checking' | 'missing' | 'denied' }
  | { status: 'settings-unavailable'; retry: () => void }
  | { status: 'unavailable'; retry?: () => void }

/** Only a hydrated matching selection identifies the intended inbox. The GET
 * independently authenticates the caller and authorizes this site on every read. */
export function useNotificationScope(): NotificationScope {
  const { currentSite, requestScope, isLoading: siteLoading, error, refreshSites } = useSite()
  const { user, isLoading: authLoading } = useAuth()
  const screen = useOptionalScreenAccess()
  if (authLoading) return { status: 'checking' }
  if (!user || user.is_anonymous || currentSite?.id.startsWith('demo-')) return { status: 'denied' }
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
  if (!currentSite || siteLoading || screen.screenScopeStatus === 'loading') return { status: 'checking' }
  const proof = screen.verifiedWorkspaceLists
  const allowed = screen.screenScopeStatus === 'legacy' ? screen.legacyWorkspaceListsAllowed
    : screen.screenScopeStatus === 'ready' && proof?.actorId === user.id && proof.siteId === currentSite.id
  return allowed ? { status: 'ready', target: requestScope } : { status: 'unavailable', retry: screen.retryScreenScope }
}