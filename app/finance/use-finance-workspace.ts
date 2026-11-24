"use client"

import { useSite } from '@/app/context/SiteContext'
import { useAuth } from '@/app/hooks/use-auth'
import { isKnownDemoSite } from '@/lib/demo-data'
import { getDemoSiteId } from '@/lib/demo-utils'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Partition private UI state; never use a provisional site ID to start a financial read. */
export function useFinanceWorkspace() {
  const { currentSite, isLoading, requestScope } = useSite()
  const { user, isLoading: authLoading } = useAuth()
  const siteId = currentSite?.id
  const demo = isKnownDemoSite(siteId)
  const actorId = user?.is_anonymous ? undefined : user?.id
  const identity = demo ? actorId ?? siteId : actorId
  const matches = (demo && getDemoSiteId() === siteId) || (!!siteId && UUID.test(siteId) && !!actorId &&
    requestScope?.actorId === actorId && requestScope.siteId === siteId)
  const loading = isLoading || (!demo && authLoading)
  const key = siteId && identity && matches
    ? JSON.stringify([siteId, identity]) : null
  return { currentSite, siteId, actorId: identity, key, ready: !loading && key !== null, loading }
}