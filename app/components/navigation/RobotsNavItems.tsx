"use client"

import { useMemo } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { MenuItem } from "./MenuItem"
import { RobotsBadge } from "./RobotsBadge"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useLayout } from "@/app/context/LayoutContext"
import { requestNavigationHistoryReset } from "@/app/hooks/use-navigation-history"

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

  const agentActive = isRobotsRoute && robotsViewMode === "agent"

  return (
    <MenuItem
      href={agentHref}
      emoji="🤖"
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
  )
}
