"use client"

import { useEffect } from "react"
import { navigateOrAssign } from "@/lib/navigation/stale-router"
import { resolveInstanceIdParam } from "@/lib/navigation/robots-instance"
import {
  isInstanceListView, mobileInstanceDetailHref,
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

  useEffect(() => {
    const requested = resolveInstanceIdParam(new URLSearchParams(search))
    // Keep the current instance mounted when the breadcrumb opens the mobile list.
    if (isMobileWorkspace && !showList && requested && requested !== "new") {
      setLocalSelectedInstanceId(requested)
    }
  }, [isMobileWorkspace, showList, search, setLocalSelectedInstanceId])

  const selectInstance = (id: string) => {
    setLocalSelectedInstanceId(id)
    const instance = workspace.getInstanceById(id)
    navigateOrAssign(router, mobileInstanceDetailHref(search, id, instance?.requirement_title || instance?.name))
  }

  return { isMobileWorkspace, showList, selectInstance }
}