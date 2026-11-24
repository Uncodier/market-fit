"use client"

import { useEffect, useMemo, useState } from 'react'
import { getUnreadNotificationCount } from './actions'
import { useNotificationScope } from './use-notification-scope'

export function useNotificationBadge(inboxOpen: boolean) {
  const workspace = useNotificationScope()
  const target = !inboxOpen && workspace.status === 'ready' ? workspace.target : undefined
  const actor = target?.actorId
  const site = target?.siteId
  const scope = useMemo(() => actor && site ? { actor, site } : null, [actor, site])
  const [result, setResult] = useState<{ scope: NonNullable<typeof scope>; count: number } | null>(null)
  useEffect(() => {
    if (!scope) return
    let request: AbortController | undefined
    let active = true
    const suspend = () => { clearTimeout(timer); request?.abort() }
    const load = () => {
      suspend()
      const controller = new AbortController()
      request = controller
      void getUnreadNotificationCount(scope.site, scope.actor, controller.signal)
        .then(count => { if (active && !controller.signal.aborted) setResult({ scope, count }) })
        .catch(() => { if (active && !controller.signal.aborted) setResult(null) })
    }
    const resume = (event: PageTransitionEvent) => { if (event.persisted) load() }
    const timer = setTimeout(load, 1200)
    window.addEventListener('pagehide', suspend); window.addEventListener('pageshow', resume)
    return () => { active = false; suspend(); window.removeEventListener('pagehide', suspend); window.removeEventListener('pageshow', resume) }
  }, [scope])
  return result && result.scope === scope ? result.count : 0
}