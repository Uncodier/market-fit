"use client"

import { useEffect } from "react"
import { navigateOrAssign } from "@/lib/navigation/stale-router"
import {
  isInstanceListView, mobileInstanceDetailHref, mobileInstanceListHref,
  shouldCanonicalizeMobileInstance,
} from "./mobile-instance-navigation"
import type { useWorkspaceTabs } from "./use-workspace-tabs"

export function useMobileInstanceNavigation(workspace: ReturnType<typeof useWorkspaceTabs>) {
  const { isMobile, searchParams, selectedInstanceId, activeRobotInstance, router, setLocalSelectedInstanceId } = workspace
  const search = searchParams.toString()
  const isMobileWorkspace = isMobile && searchParams.get("artifact") !== "true"
  const showList = isMobileWorkspace && isInstanceListView(searchParams)

  useEffect(() => {
    if (!isMobileWorkspace || !activeRobotInstance || !shouldCanonicalizeMobileInstance(search, selectedInstanceId)) return
    // Expose the existing automatic selection in the URL, so the bottom bar hides.
    const params = new URLSearchParams(search)
    params.set("instance", selectedInstanceId)
    router.replace(`/robots?${params}`, { scroll: false })
  }, [isMobileWorkspace, activeRobotInstance, search, selectedInstanceId, router])

  const backToInstances = () => {
    // Keep the active instance and its mounted draft; only change the visible screen.
    setLocalSelectedInstanceId(selectedInstanceId)
    navigateOrAssign(router, mobileInstanceListHref(search))
  }

  const selectInstance = (id: string) => {
    setLocalSelectedInstanceId(id)
    const instance = workspace.getInstanceById(id)
    navigateOrAssign(router, mobileInstanceDetailHref(search, id, instance?.requirement_title || instance?.name))
  }

  return { isMobileWorkspace, showList, backToInstances, selectInstance }
}