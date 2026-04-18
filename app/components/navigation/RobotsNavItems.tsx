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

  /** Same destination for both entries; mode is set only via sidebar (context). */
  const robotsHref = useMemo(() => {
    const p = new URLSearchParams(searchQueryString)
    p.delete("mode")
    const q = p.toString()
    return q ? `/robots?${q}` : "/robots"
  }, [searchQueryString])

  const agentActive = isRobotsRoute && robotsViewMode === "agent"
  const imprentaActive = isRobotsRoute && robotsViewMode === "imprenta"

  return (
    <>
      <MenuItem
        href={robotsHref}
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
      <MenuItem
        href={robotsHref}
        emoji="🖨️"
        title={t("layout.sidebar.imprenta") || "Content Creator"}
        isActive={imprentaActive}
        isCollapsed={isCollapsed}
        onClick={() => {
          setRobotsViewMode("imprenta")
          requestNavigationHistoryReset()
        }}
      />
    </>
  )
}
