"use client"

import { useContext, useEffect, useMemo, useState } from 'react'
import { AuthContext } from '@/app/components/auth/auth-context'
import { isDemoModeActive } from '@/lib/demo-utils'
import type { Site } from './site-types'
import { readProjectLogos } from '@/lib/sites/logo-background-sync'

/** An open project directory may decorate its visible rows. Identity hints and
 * the closed selector never initiate a second membership scan just for logos. */
export function useDirectoryLogos(sites: readonly Site[], visible: boolean) {
  const auth = useContext(AuthContext)
  const actor = !auth?.isLoading && !auth?.user?.is_anonymous ? auth?.user?.id : undefined
  return useProjectListLogos(sites, visible && !isDemoModeActive() ? actor : null)
}

export function useProjectListLogos(sites: readonly Site[], actor: string | undefined | null) {
  const ids = actor ? sites.filter(s => !s.id.startsWith('demo-') && s.logo_url === undefined).map(s => s.id) : []
  const key = ids.length ? JSON.stringify([...new Set(ids)].sort()) : null
  const scope = useMemo(() => actor && key ? { actor, ids: JSON.parse(key) as string[] } : null, [actor, key])
  const [result, setResult] = useState<{ scope: NonNullable<typeof scope>; logos: Record<string, string | null> } | null>(null)
  useEffect(() => {
    if (!scope) return
    const controller = new AbortController()
    void readProjectLogos(scope.actor, scope.ids, controller.signal).then(logos => {
      if (!controller.signal.aborted) setResult({ scope, logos })
    }).catch(() => { /* Decorative only: keep the initials on a failed read. */ })
    return () => controller.abort()
  }, [scope])
  return result && result.scope === scope ? result.logos : undefined
}