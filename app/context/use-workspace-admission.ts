import { useEffect, useLayoutEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isDemoModeActive, isRealSiteId } from '@/lib/demo-utils'
import type { WorkspaceRequestScope } from './site-types'

export const WORKSPACE_ADMISSION_INTERVAL_MS = 60_000

/** The selected site's effective role can expire without any realtime event. */
export function useWorkspaceAdmission(scope: WorkspaceRequestScope | null, onLost: (scope: WorkspaceRequestScope) => void) {
  const latest = useRef(onLost)
  useLayoutEffect(() => { latest.current = onLost }, [onLost])
  const actorId = scope?.actorId
  const siteId = scope?.siteId

  useEffect(() => {
    if (!actorId || !siteId || !isRealSiteId(siteId) || isDemoModeActive()) return
    let active = true
    let pending: AbortController | null = null
    const check = async () => {
      if (!active || pending || document.visibilityState === 'hidden' || isDemoModeActive()) return
      const controller = new AbortController()
      pending = controller
      const stillCurrent = () => active && !controller.signal.aborted
      const deadline = setTimeout(() => { controller.abort(); if (pending === controller) pending = null }, 8_000)
      try {
        const db = createClient()
        const readRole = () => db.rpc('current_user_site_role', { p_site_id: siteId })
          .retry(false).abortSignal(controller.signal)
        const { data, error } = await readRole()
        // A network error, expired session or unexpected response is not revocation.
        if (!stillCurrent() || error || data !== null) return
        const auth = await db.auth.getUser()
        if (!stillCurrent() || auth.error || auth.data.user?.id !== actorId || auth.data.user.is_anonymous) return
        const confirmed = await readRole()
        if (stillCurrent() && !confirmed.error && confirmed.data === null) latest.current({ actorId, siteId })
      } catch { /* Retry on the next visible check without clearing selection. */ }
      finally {
        clearTimeout(deadline)
        if (pending === controller) pending = null
      }
    }
    void check()
    const timer = setInterval(check, WORKSPACE_ADMISSION_INTERVAL_MS)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('online', check)
    return () => {
      active = false
      pending?.abort()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('online', check)
    }
  }, [actorId, siteId])
}