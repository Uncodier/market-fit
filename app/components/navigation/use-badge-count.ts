"use client"

import { useEffect, useState } from "react"
import { useAuthContext } from "@/app/components/auth/auth-context"
import { useSite } from "@/app/context/SiteContext"
import { BadgePollController } from "./badge-poll-controller"
import { fetchBadgeCount, type BadgeResource } from "./badge-count-queries"

export function useBadgeCount(resource: BadgeResource): number {
  const { currentSite, isLoading: siteLoading } = useSite()
  const { user, isLoading: authLoading } = useAuthContext()
  const siteId = currentSite?.id
  // The existing context exposes user, not tokens/session. Include sign-in epoch
  // when available, never a bearer token; a context logout disables polling.
  const identity = user ? `${user.id}:${user.last_sign_in_at ?? ""}` : siteId?.startsWith("demo-") ? "demo" : null
  const key = !siteLoading && !authLoading && identity && siteId ? JSON.stringify([resource, siteId, identity]) : null
  const [controller] = useState(() => new BadgePollController())
  const [result, setResult] = useState<{ key: string; value: number } | null>(null)

  useEffect(() => {
    if (!key || !siteId) return
    return controller.start({
      query: signal => fetchBadgeCount(resource, siteId, signal),
      onValue: value => setResult({ key, value }),
      intervalMs: resource === "chats" || resource === "leads" ? 10_000 : 30_000,
      timeoutMs: 8_000,
    })
  }, [controller, key, resource, siteId])

  // Hide old-site/identity data in the very render that changes the key, not only
  // after passive effect cleanup. Old requests cannot publish into a newer key.
  return key && result?.key === key ? result.value : 0
}