"use client"

import { useState } from "react"
import { NavigationLink } from "@/app/components/navigation/NavigationLink"
import { ArrowUpRight } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { usePrivateReviews } from "./private-reviews"

/** Mounted per conversation and within the actor/site-keyed private scope. */
export function ReviewInstanceLink({ conversationId }: { conversationId: string }) {
  const { t } = useLocalization()
  const { byConversation, authorized } = usePrivateReviews()
  const requests = byConversation.get(conversationId) ?? []
  const ids = new Set(requests.map(item => item.conversation_id === null ? item.context?.instance_id : null))
  const id = ids.size === 1 ? [...ids][0] : null
  const [lastOrigin, setLastOrigin] = useState<string | null>(null)
  const target = !authorized ? null : requests.length ? id ?? null : lastOrigin
  if (target !== lastOrigin) setLastOrigin(target)
  if (!target) return <span className="text-sm font-medium">{t("connectors.internalConversation")}</span>
  return <NavigationLink href={`/robots?instance=${encodeURIComponent(target)}`} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
    {t("connectors.openReviewInstance")}<ArrowUpRight className="h-4 w-4" aria-hidden={true} />
  </NavigationLink>
}