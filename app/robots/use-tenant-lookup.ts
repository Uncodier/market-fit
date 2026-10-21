"use client"

import { useEffect, useRef, useState } from "react"
import { databaseFallbackUrl, lookupTenantUrl, tenantLookupIdentity } from "./tenant-lookup"

interface TenantLookupInput {
  siteId?: string
  instanceId?: string
  instanceSiteId?: string
  requirementIds: Array<string | null | undefined>
}

interface LookupState {
  identity: string
  url?: string
  error?: unknown
  isLoading: boolean
}

export function useTenantLookup(input: TenantLookupInput) {
  const requirementIds = Array.from(new Set(input.requirementIds.filter(
    (id): id is string => Boolean(id),
  ))).sort()
  const enabled = Boolean(input.siteId && input.instanceId &&
    (!input.instanceSiteId || input.instanceSiteId === input.siteId))
  const identity = enabled ? tenantLookupIdentity({
    siteId: input.siteId!, instanceId: input.instanceId!, requirementIds,
  }) : ''
  const [state, setState] = useState<LookupState>({ identity: '', isLoading: false })
  // Keep document suspension across key changes while the page is in bfcache.
  const suspended = useRef(false)

  useEffect(() => {
    let mounted = true
    let active: AbortController | null = null

    const cancel = () => {
      active?.abort()
      active = null
    }
    const start = async () => {
      if (!mounted || suspended.current || !identity) return
      cancel()
      const controller = new AbortController()
      active = controller
      const isCurrent = () => mounted && !suspended.current &&
        active === controller && !controller.signal.aborted
      const [siteId, instanceId, ids] = JSON.parse(identity) as [string, string, string[]]
      setState(previous => ({
        identity, isLoading: true,
        url: previous.identity === identity ? previous.url : undefined,
      }))
      try {
        const url = await lookupTenantUrl({ siteId, instanceId, requirementIds: ids }, controller.signal)
        if (isCurrent()) setState({ identity, url, isLoading: false })
      } catch (error) {
        if (controller.signal.aborted) return
        // Do not classify unknown TypeError/CORS or unowned AbortError as cancellation.
        if (isCurrent()) {
          console.error("Error fetching tenant info for database artifact:", error)
          setState({ identity, error, isLoading: false })
          // Promise.all may reject while sibling requests are still pending.
          controller.abort()
        }
      } finally {
        if (active === controller) active = null
      }
    }
    const handlePageHide = () => {
      suspended.current = true
      cancel()
    }
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted || !mounted || !suspended.current) return
      suspended.current = false
      void start()
    }
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('pageshow', handlePageShow)
    void start()
    return () => {
      mounted = false
      cancel()
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [identity])

  const current = state.identity === identity ? state : undefined
  return {
    url: current?.url ?? databaseFallbackUrl(input.instanceId),
    error: current?.error,
    isLoading: enabled && (current?.isLoading ?? true),
  }
}