"use client"

import { useEffect, useState } from "react"
import { getStorefrontItem } from "@/app/commerce/storefront-item-action"

/** No SWR/global persistence: a personalized booking item belongs to this mounted view only. */
export function useStorefrontBookingItem(id: string, channel: "shop" | "marketplace", siteId?: string, enabled = true) {
  const key = `${channel}:${siteId || ""}:${id}`
  const [state, setState] = useState<{ key: string; item: Awaited<ReturnType<typeof getStorefrontItem>> }>()
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    getStorefrontItem({ id, channel, siteId }).then(item => {
      if (!cancelled) setState({ key, item })
    }).catch(() => { if (!cancelled) setState({ key, item: null }) })
    return () => { cancelled = true }
  }, [id, channel, siteId, key, enabled])
  return { item: state?.key === key ? state.item : null, isLoading: !enabled || state?.key !== key }
}