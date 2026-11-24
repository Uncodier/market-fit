"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuthContext } from '@/app/components/auth/auth-context'
import { createClient } from '@/lib/supabase/client'
import { isRealSiteId } from '@/lib/demo-utils'
import { readWorkspaceScreenScope, type ScreenScope } from '@/lib/permissions/workspace-screen-scope'
import { onScreenScopeChanged } from '@/lib/permissions/screen-scope-invalidation'
import { useOptionalSite } from './SiteContext'

interface Snapshot { actor?: string; siteId: string | null; read?: ScreenScope; retry: () => void }
const SnapshotContext = createContext<Snapshot | null>(null)
export const useWorkspaceAccessSnapshot = () => useContext(SnapshotContext)

/** Navigation and capability hints consume the same server-verified effective
 * role. Neither replaces authorization inside any API, SQL policy or action. */
export function WorkspaceAccessSnapshot({ children }: { children: ReactNode }) {
  const site = useOptionalSite()
  const auth = useAuthContext()
  const actor = auth.isLoading || auth.user?.is_anonymous ? undefined : auth.user?.id
  const current = site?.currentSite?.id
  const target = site?.requestScope
  const siteId = actor && target?.actorId === actor && (!current || current === target.siteId) ? target.siteId : null
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt(n => n + 1), [])
  const [result, setResult] = useState<{ scope: object; read: ScreenScope } | null>(null)
  const scope = useMemo(() => ({ actor, siteId, attempt }), [actor, siteId, attempt])
  useEffect(() => siteId ? onScreenScopeChanged(siteId, retry) : undefined, [siteId, retry])

  useEffect(() => {
    if (!scope.actor || !scope.siteId || !isRealSiteId(scope.siteId)) return
    const controller = new AbortController()
    const publish = (read: ScreenScope) => setResult({ scope, read })
    const timer = setTimeout(() => { controller.abort(); publish({ status: 'unavailable' }) }, 8_000)
    void readWorkspaceScreenScope(createClient(), scope.actor, scope.siteId, controller.signal)
      .then(read => { if (!controller.signal.aborted) publish(read) }, () => {
        if (!controller.signal.aborted) publish({ status: 'unavailable' })
      }).finally(() => clearTimeout(timer))
    return () => { clearTimeout(timer); controller.abort() }
  }, [scope])

  const read = result?.scope === scope ? result.read : undefined
  const value = useMemo(() => ({ actor, siteId, read, retry }), [actor, siteId, read, retry])
  return <SnapshotContext.Provider value={value}>{children}</SnapshotContext.Provider>
}