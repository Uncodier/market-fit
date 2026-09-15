"use client"

import { useMemo } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { MenuItem } from "./MenuItem"
import { Bot, Printer, Workflow } from "@/app/components/ui/icons"
import { RobotsBadge } from "./RobotsBadge"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useLayout } from "@/app/context/LayoutContext"
import { NAV_ITEM_ICON, getModuleVisual } from "@/app/config/module-visuals"
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

  const overviewHref = useMemo(() => {
    const p = new URLSearchParams()
    if (new URLSearchParams(searchQueryString).get("artifact") === "true") {
      p.set("artifact", "true")
    }
    p.set("tab", "overview")
    return `/dashboard?${p.toString()}`
  }, [searchQueryString])

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

  const overviewActive = pathname.startsWith("/dashboard") && searchParams.get("tab") === "overview"
  const agentActive = isRobotsRoute && robotsViewMode === "agent"
  const imprentaActive = isRobotsRoute && robotsViewMode === "imprenta"
  const workflowActive = isRobotsRoute && robotsViewMode === "workflow"
  const screenAccess = useOptionalScreenAccess()
  const showOverview = !screenAccess || screenAccess.canAccessNavKey("reportOverview")
  const showContentCreator = !screenAccess || screenAccess.canAccessNavKey("contentCreator")
  const showWorkflows = !screenAccess || screenAccess.canAccessNavKey("workflows")
  const showChannels = !screenAccess || screenAccess.canAccessNavKey("channels")

  const channelsHref = useMemo(() => {
    const p = new URLSearchParams()
    if (new URLSearchParams(searchQueryString).get("artifact") === "true") {
      p.set("artifact", "true")
    }
    p.set("tab", "channels")
    return `/settings?${p.toString()}`
  }, [searchQueryString])

  const channelsActive = pathname.startsWith("/settings") && searchParams.get("tab") === "channels"

  return (
    <>
      {showOverview && (
      <MenuItem
        href={overviewHref}
        icon={NAV_ITEM_ICON.reportOverview}
        title={t("layout.sidebar.summary") || "Overview"}
        isActive={overviewActive}
        isCollapsed={isCollapsed}
        onClick={() => {
          resetBreadcrumbTrail()
        }}
      />
      )}
      <MenuItem
        id="tour-agents-nav"
        href={agentHref}
        icon={Bot}
        title={t("layout.sidebar.agents") || "Agents"}
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
      {showChannels && (
      <MenuItem
        id="tour-channels-nav"
        href={channelsHref}
        icon={NAV_ITEM_ICON.channels}
        title={t("settings.tabs.channels") === "settings.tabs.channels" ? "Agent Channels" : t("settings.tabs.channels")}
        isActive={channelsActive}
        isCollapsed={isCollapsed}
        onClick={() => {
          resetBreadcrumbTrail()
        }}
        visual={NAV_ITEM_ICON.channels ? undefined : undefined /* Use standard icon color */}
      />
      )}
    </>
  )
}
