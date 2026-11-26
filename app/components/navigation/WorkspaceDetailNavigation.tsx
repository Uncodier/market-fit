"use client"

import { useSearchParams } from "next/navigation"
import { useOptionalSite } from "@/app/context/SiteContext"
import { DETAIL_VIEW_PARAM, getDetailViewNeighbors } from "@/lib/navigation/detail-view-navigation"
import { DetailViewControls } from "./DetailViewControls"

export function WorkspaceDetailNavigation({ pathname }: { pathname: string }) {
  const key = useSearchParams()?.get(DETAIL_VIEW_PARAM)
  const site = useOptionalSite()
  const siteId = site?.currentSite?.id
  if (!key || !siteId || site?.isLoading) return null
  const neighbors = getDetailViewNeighbors(siteId, pathname, key)
  if (!neighbors || (!neighbors.previous && !neighbors.next)) return null
  return <div className="hidden md:block"><DetailViewControls neighbors={neighbors} /></div>
}