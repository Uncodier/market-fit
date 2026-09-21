"use client"

import { useMemo } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { MenuItem } from "./MenuItem"
import { Home, Printer, Workflow } from "@/app/components/ui/icons"
import { RobotsBadge } from "./RobotsBadge"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useLayout } from "@/app/context/LayoutContext"
import { useOptionalScreenAccess } from "@/app/context/ScreenAccessContext"

function resetBreadcrumbTrail() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("navigation-history:reset"))
}

interface RobotsNavItemsProps {
  isCollapsed: boolean
}

export function RobotsNavItems({ isCollapsed }: RobotsNavItemsProps) {
  const { t } = useLocalization()
  const { robotsViewMode, setRobotsViewMode } = useLayout()
  const pathname = usePathname()
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

  return (
    <>
      <MenuItem
        id="tour-agents-nav"
        href={agentHref}
        icon={Home}
        title={t("layout.sidebar.agents") || "AI Workspace"}
        isActive={agentActive}
        isCollapsed={isCollapsed}
        onClick={() => {
          setRobotsViewMode("agent")
          resetBreadcrumbTrail()
        }}
      >
        <RobotsBadge isActive={agentActive} />
      </MenuItem>
      {showContentCreator && (
      <MenuItem
        id="tour-content-nav"
        href={imprentaHref}
        icon={Printer}
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
        icon={Workflow}
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
