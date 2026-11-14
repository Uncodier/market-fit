"use client"

import { useEffect, useMemo, useState } from 'react'
import { isAuthSessionMissingError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { parseCapabilities } from '@/lib/permissions/capabilities'

export const ROBOTS_PERMISSION_TIMEOUT_MS = 8000
let nextRevision = 0

type PermissionSnapshot = { token: object; revision: number; allowed: boolean }

function explicitSelect(data: unknown): boolean | undefined {
  // Match the existing capability payload formats without changing the global parser.
  for (let depth = 0; depth < 5; depth++) {
    if (typeof data === 'string') {
      try { data = JSON.parse(data) } catch { return undefined }
    } else if (Array.isArray(data)) {
      data = data[0]
    } else if (data && typeof data === 'object') {
      const value = data as Record<string, unknown>
      if (typeof value.select === 'boolean') return value.select
      if (value.get_my_site_capabilities != null && value.role === undefined) {
        data = value.get_my_site_capabilities
      } else return undefined
    } else return undefined
  }
  return undefined
}

/** Cache freshness only. RLS still authorizes every Robots read. */
export function useRobotsPermissionRevision(siteId: string | null, userId: string | null) {
  const scope = JSON.stringify([siteId, userId])
  const token = useMemo(() => ({ scope }), [scope])
  const [snapshot, setSnapshot] = useState<PermissionSnapshot | null>(null)

  useEffect(() => {
    if (!siteId || !userId || siteId.startsWith('demo-')) return
    let disposed = false
    let running = false
    let baseline: string | undefined
    let controller: AbortController | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined
    const publish = (fingerprint: string, allowed: boolean) => {
      if (disposed || fingerprint === baseline) return
      baseline = fingerprint
      // Never reuse a previous generation, even when permissions toggle back.
      setSnapshot({ token, revision: ++nextRevision, allowed })
    }
    const check = async () => {
      if (disposed || running || !navigator.onLine || document.visibilityState !== 'visible') return
      running = true
      let timedOut = false
      controller = new AbortController()
      timeout = setTimeout(() => {
        timedOut = true
        controller?.abort()
        // Keep single-flight until SDK settlement, including an unabortable auth read.
      }, ROBOTS_PERMISSION_TIMEOUT_MS)
      try {
        const client = createClient()
        const auth = await client.auth.getUser()
        if (disposed || timedOut) return
        if (auth.error) {
          if (isAuthSessionMissingError(auth.error) || auth.error.status === 401 || auth.error.status === 403) {
            publish('signed-out', false)
          }
          return
        }
        if (auth.data.user?.id !== userId) { publish('actor-changed', false); return }
        const [membership, capabilities] = await Promise.all([
          client.from('site_members').select('role,status,restrict_to_assigned_only')
            .eq('site_id', siteId).eq('user_id', userId).maybeSingle().abortSignal(controller.signal),
          client.rpc('get_my_site_capabilities', { p_site_id: siteId }).abortSignal(controller.signal),
        ])
        if (disposed || timedOut) return
        if (membership.error || capabilities.error) {
          if (membership.error?.code === '42501' || capabilities.error?.code === '42501') publish('denied', false)
          return
        }
        const caps = parseCapabilities(capabilities.data)
        if (!caps) return
        const select = explicitSelect(capabilities.data)
        const member = membership.data
        const allowed = select !== false && caps.select && (caps.is_owner || member?.status === 'active')
        publish(JSON.stringify([caps, select ?? null, member?.role ?? null, member?.status ?? null,
          member?.restrict_to_assigned_only ?? null]), allowed)
      } catch {
        // A transport failure is not evidence of revocation. Keep the confirmed generation.
      } finally {
        clearTimeout(timeout)
        running = false
      }
    }
    const visible = () => { void check() }
    window.addEventListener('focus', visible)
    window.addEventListener('online', visible)
    document.addEventListener('visibilitychange', visible)
    const timer = window.setInterval(visible, 30000)
    void check()
    return () => {
      disposed = true
      clearTimeout(timeout)
      controller?.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', visible)
      window.removeEventListener('online', visible)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [siteId, userId, token])

  if (!siteId || !userId) return { revision: null, pending: false }
  if (siteId.startsWith('demo-')) return { revision: `demo:${scope}`, pending: false }
  const confirmed = snapshot?.token === token
  return {
    revision: confirmed && snapshot.allowed ? snapshot.revision : null,
    pending: !confirmed,
  }
}