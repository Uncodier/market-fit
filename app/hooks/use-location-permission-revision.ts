"use client"

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { locationPermissionRevision } from '@/lib/permissions/location-revision'
import { invalidateAgentsCache } from '@/app/agents/agents-cache'

export const LOCATION_REVISION_TIMEOUT_MS = 8000
const reloadDocument = () => window.location.reload()

/** Discard warm React/browser projections when the server-owned permission set changes. */
export function useLocationPermissionRevision(siteId: string | null, resetDocument = reloadDocument) {
  const isPos = usePathname() === '/pos'
  const previousScope = useRef<{ siteId: string | null; value?: string }>({ siteId })
  useEffect(() => {
    if (previousScope.current.siteId !== siteId) previousScope.current = { siteId }
    // The POS owns a stricter actor/site lease and revocation gate. A second
    // document-reset monitor would interrupt checkout on transient RPC failures.
    // Other routes, including POS check-in, retain the global security reset.
    if (isPos) return
    if (!siteId || siteId.startsWith('demo-')) return
    let disposed = false
    let running = false
    let resetting = false
    let baseline = previousScope.current.value
    let timeout: ReturnType<typeof setTimeout> | undefined
    let generation = 0
    const reset = () => {
      if (disposed || resetting) return
      resetting = true
      invalidateAgentsCache()
      resetDocument()
    }
    const check = async () => {
      if (disposed || running || resetting || !navigator.onLine) return
      running = true
      const request = ++generation
      timeout = setTimeout(() => {
        if (disposed || request !== generation) return
        generation += 1
        running = false
        // Retire an already mounted private snapshot when freshness cannot be
        // established. On first load there is no baseline to retire or reload loop.
        if (baseline !== undefined) reset()
      }, LOCATION_REVISION_TIMEOUT_MS)
      try {
        const client = createClient()
        const auth = await client.auth.getUser()
        if (disposed || request !== generation) return
        if (!auth.data.user || auth.error) {
          if (baseline !== undefined) reset()
          return
        }
        const { data, error } = await client.rpc('current_user_location_access', { p_site_id: siteId })
        if (disposed || request !== generation) return
        if (error) {
          // Membership revocation raises 42501; it does not return a null scope.
          if (baseline !== undefined) reset()
          return
        }
        const revision = locationPermissionRevision(data, siteId)
        if (revision === null) { if (baseline !== undefined) reset(); return }
        const next = JSON.stringify([auth.data.user?.id ?? null, revision])
        if (baseline !== undefined && next !== baseline) {
          // A security revocation is a deliberate document reset, not navigation recovery.
          // Server checks remain mandatory; already exported data cannot be erased.
          reset()
          return
        }
        baseline = next
        previousScope.current.value = next
      } catch { if (baseline !== undefined && request === generation) reset() }
      finally {
        if (request === generation) {
          clearTimeout(timeout)
          running = false
        }
      }
    }
    const visible = () => { if (document.visibilityState === 'visible') void check() }
    window.addEventListener('focus', visible)
    window.addEventListener('online', visible)
    document.addEventListener('visibilitychange', visible)
    const timer = window.setInterval(() => void check(), 30000)
    void check()
    return () => {
      disposed = true
      generation += 1
      clearTimeout(timeout)
      window.clearInterval(timer)
      window.removeEventListener('focus', visible)
      window.removeEventListener('online', visible)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [siteId, resetDocument, isPos])
}