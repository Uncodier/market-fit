"use client"

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react"
import type { z } from "zod"
import { approvalInboxSchema, type approvalRequestSchema } from "@/app/connectors/approval-contract"
import { scopedConnectorPath } from "@/app/connectors/connector-request"
import { useConnectorResource } from "@/app/connectors/use-connector-resource"

export type ReviewRequest = z.infer<typeof approvalRequestSchema>

export function indexReviews(items: ReviewRequest[]) {
  const byConversation = new Map<string, ReviewRequest[]>()
  for (const item of items) {
    const id = item.review_conversation_id ?? item.conversation_id
    if (!id) continue
    const requests = byConversation.get(id) ?? []
    requests.push(item)
    byConversation.set(id, requests)
  }
  return byConversation
}

const PrivateReviews = createContext({ byConversation: indexReviews([]), siteId: "", authorized: false, refreshing: false, reload: () => {} })
export const usePrivateReviews = () => useContext(PrivateReviews)

export function PrivateReviewScope({ siteId, actorId, children, enabled = true }: { siteId?: string; actorId?: string; children: ReactNode; enabled?: boolean }) {
  if (!siteId || !actorId) return <>{children}</>
  return <AuthorizedList key={`${siteId}:${actorId}`} siteId={siteId} enabled={enabled}>{children}</AuthorizedList>
}

function AuthorizedList({ siteId, enabled, children }: { siteId: string; enabled: boolean; children: ReactNode }) {
  const { data, previousData, error, reload } = useConnectorResource(enabled ? scopedConnectorPath("approvals", siteId) : null, approvalInboxSchema)
  const items = enabled ? (data ?? previousData)?.items : undefined
  const byConversation = useMemo(() => indexReviews(items ?? []), [items])
  useEffect(() => {
    if (!enabled) return
    const refresh = () => { if (document.visibilityState === 'visible' && navigator.onLine) reload() }
    window.addEventListener("focus", refresh)
    const timer = error ? undefined : window.setInterval(refresh, 60_000)
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh) }
  }, [enabled, error, reload])
  return <PrivateReviews.Provider value={{ siteId, byConversation, authorized: !!items, refreshing: enabled && !data && !error, reload }}>{children}</PrivateReviews.Provider>
}
