"use client"

import { useEffect, useState } from "react"
import { PosSyncBadge } from "@/app/pos/components/PosSyncBadge"
import {
  getPosSyncStatus,
  subscribePosSync,
  pullPosCatalogInBackground,
  type SyncStatus,
} from "@/app/pos/local/sync-engine"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"

export function PosTopBarSync() {
  const { currentSite } = useSite()
  const { t, locale } = useLocalization()
  const [snapshot, setSnapshot] = useState<{ siteId: string; status: SyncStatus } | null>(null)
  const siteId = currentSite?.id

  useEffect(() => {
    if (!siteId) return
    let active = true
    queueMicrotask(() => {
      if (active) setSnapshot({ siteId, status: getPosSyncStatus(siteId) })
    })
    const unsubscribe = subscribePosSync((nextStatus) => {
      if (active) setSnapshot({ siteId, status: { ...nextStatus } })
    }, siteId)
    return () => { active = false; unsubscribe() }
  }, [siteId])

  if (!snapshot || snapshot.siteId !== siteId) return null

  return (
    <PosSyncBadge
      key={siteId}
      status={snapshot.status}
      locale={locale}
      onRefresh={() => { if (siteId) void pullPosCatalogInBackground(siteId, true) }}
      onClick={() =>
        window.dispatchEvent(new CustomEvent("pos:open-sync-issues"))
      }
      t={t}
    />
  )
}
