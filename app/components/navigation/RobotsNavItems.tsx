"use client"

import { useMemo } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { MenuItem } from "./MenuItem"
import { Bot, Printer } from "@/app/components/ui/icons"
import { RobotsBadge } from "./RobotsBadge"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useLayout } from "@/app/context/LayoutContext"
import { requestNavigationHistoryReset } from "@/app/hooks/use-navigation-history"
import { NAV_ITEM_ICON } from "@/app/config/module-visuals"
import { useOptionalScreenAccess } from "@/app/context/ScreenAccessContext"

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

  const overviewActive = pathname.startsWith("/dashboard") && searchParams.get("tab") === "overview"
  const agentActive = isRobotsRoute && robotsViewMode === "agent"
  const imprentaActive = isRobotsRoute && robotsViewMode === "imprenta"
  const screenAccess = useOptionalScreenAccess()
  const showOverview = !screenAccess || screenAccess.canAccessNavKey("reportOverview")
  const showContentCreator = !screenAccess || screenAccess.canAccessNavKey("contentCreator")

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
          requestNavigationHistoryReset()
        }}
      />
      )}
      <MenuItem
        href={agentHref}
        icon={Bot}
        title={t("layout.sidebar.agents") || "Agents"}
        isActive={agentActive}
        isCollapsed={isCollapsed}
        onClick={() => {
          setRobotsViewMode("agent")
          requestNavigationHistoryReset()
        }}
      >
        <RobotsBadge isActive={agentActive} />
      </MenuItem>
      {showContentCreator && (
      <MenuItem
        href={imprentaHref}
        icon={Printer}
        title={t("layout.sidebar.imprenta") || "Content Creator"}
        isActive={imprentaActive}
        isCollapsed={isCollapsed}
        onClick={() => {
          setRobotsViewMode("imprenta")
          requestNavigationHistoryReset()
        }}
      />
      )}
    </>
  )
}
