"use client"

import { useCallback, useEffect, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { MenuItem } from "./MenuItem"
import { RobotsBadge } from "./RobotsBadge"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useLayout } from "@/app/context/LayoutContext"
import { useOptionalScreenAccess } from "@/app/context/ScreenAccessContext"
import { navigateOrAssign } from "@/lib/navigation/stale-router"

function resetBreadcrumbTrail() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("navigation-history:reset"))
}

interface RobotsNavItemsProps {
  isCollapsed: boolean
  onWorkspaceNavigation?: () => void
}

export function RobotsNavItems({ isCollapsed, onWorkspaceNavigation }: RobotsNavItemsProps) {
  const { t } = useLocalization()
  const { robotsViewMode, setRobotsViewMode } = useLayout()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchQueryString = searchParams.toString()

  const isRobotsRoute = pathname === "/robots" || pathname.startsWith("/robots/")

  const agentHref = useMemo(() => {
    const p = new URLSearchParams(searchQueryString)
    p.delete("mode")
    const q = p.toString()
    return q ? `/robots?${q}` : "/robots"
  }, [searchQueryString])

  const imprentaHref = useMemo(() => {
    const p = new URLSearchParams(searchQueryString)
    p.set("mode", "imprenta")
    return `/robots?${p.toString()}`
  }, [searchQueryString])

  const workflowHref = useMemo(() => {
    const p = new URLSearchParams(searchQueryString)
    p.set("mode", "workflow")
    return `/robots?${p.toString()}`
  }, [searchQueryString])

  const agentActive = isRobotsRoute && robotsViewMode === "agent"
  const imprentaActive = isRobotsRoute && robotsViewMode === "imprenta"
  const workflowActive = isRobotsRoute && robotsViewMode === "workflow"
  const screenAccess = useOptionalScreenAccess()
  const showContentCreator = !screenAccess || screenAccess.canAccessNavKey("contentCreator")
  const showWorkflows = !screenAccess || screenAccess.canAccessNavKey("workflows")

  const activateAgentView = useCallback(() => {
    setRobotsViewMode("agent")
    resetBreadcrumbTrail()
    onWorkspaceNavigation?.()
  }, [setRobotsViewMode, onWorkspaceNavigation])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.shiftKey ||
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "i"
      ) return

      event.preventDefault()
      if (event.repeat) return
      activateAgentView()
      navigateOrAssign(router, agentHref)
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [activateAgentView, agentHref, router])

  return (
    <>
      <MenuItem
        id="tour-agents-nav"
        href={agentHref}
        moduleImage={{ area: "automation", itemKey: "salesHome" }}
        title={t("layout.sidebar.agents") || "AI Workspace"}
        shortcut="I"
        isActive={agentActive}
        isCollapsed={isCollapsed}
        onClick={activateAgentView}
      >
        <RobotsBadge isActive={agentActive} />
      </MenuItem>
      {showContentCreator && (
      <MenuItem
        id="tour-content-nav"
        href={imprentaHref}
        moduleImage={{ area: "marketing", itemKey: "contentCreator" }}
        title={t("layout.sidebar.imprenta") || "Content Creator"}
        isActive={imprentaActive}
        isCollapsed={isCollapsed}
        onClick={() => {
          setRobotsViewMode("imprenta")
          resetBreadcrumbTrail()
        }}
      />
      )}
      {showWorkflows && (
      <MenuItem
        id="tour-workflows-nav"
        href={workflowHref}
        moduleImage={{ area: "automation", itemKey: "workflows" }}
        title={t("layout.sidebar.workflows") || "Workflows"}
        isActive={workflowActive}
        isCollapsed={isCollapsed}
        onClick={() => {
          setRobotsViewMode("workflow")
          resetBreadcrumbTrail()
        }}
      />
      )}
    </>
  )
}
