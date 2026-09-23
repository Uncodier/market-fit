"use client"

import { useEffect, useState } from "react"
import { PosSyncBadge } from "@/app/pos/components/PosSyncBadge"
import {
  getPosSyncStatus,
  subscribePosSync,
  type SyncStatus,
} from "@/app/pos/local/sync-engine"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"

export function PosTopBarSync() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const siteId = currentSite?.id

  useEffect(() => {
    if (!siteId) {
      setStatus(null)
      return
    }

    setStatus(getPosSyncStatus(siteId))
    return subscribePosSync((nextStatus) => {
      setStatus({ ...nextStatus })
    })
  }, [siteId])

  if (!status) return null

  return (
    <PosSyncBadge
      status={status}
      onClick={() =>
        window.dispatchEvent(new CustomEvent("pos:open-sync-issues"))
      }
      t={t}
    />
  )
}
