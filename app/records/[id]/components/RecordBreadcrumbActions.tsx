"use client"

import { useSearchParams } from "next/navigation"
import { DetailViewControls } from "@/app/components/navigation/DetailViewControls"
import { TopBarActionPortal } from "@/app/components/navigation/topbar-primary-actions"
import { useOptionalSite } from "@/app/context/SiteContext"
import { getRecordNeighbors } from "../../lib/record-navigation"

export function RecordBreadcrumbActions({ recordId, siteId, isSaving }: {
  recordId: string
  siteId: string
  isSaving: boolean
}) {
  const viewKey = useSearchParams()?.get("recordView")
  const site = useOptionalSite()
  if (!viewKey || site?.isLoading || site?.currentSite?.id !== siteId) return null

  const neighbors = getRecordNeighbors(siteId, recordId, viewKey)
  if (!neighbors) return null

  return <TopBarActionPortal slotId="record-breadcrumb-actions">
    <DetailViewControls neighbors={neighbors} disabled={isSaving} />
  </TopBarActionPortal>
}
