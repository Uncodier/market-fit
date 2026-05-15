"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  SIDEBAR_SCROLL_AREA_ORDER,
  NAVIGATION_AREAS,
  buildNavItemHref,
  isAreaActive,
  isNavItemActive,
  type AreaNavItem,
  type WorkspaceArea,
} from "@/app/config/navigation-areas"
import { MenuItem, EmojiIcon } from "./MenuItem"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip"
import { LeadsBadge } from "./LeadsBadge"
import { ControlCenterBadge } from "./ControlCenterBadge"
import { ContentBadge } from "./ContentBadge"
import { RequirementsBadge, CampaignsBadge } from "./RequirementsBadge"
import { ChatsBadge } from "./ChatsBadge"
import { useLocalization } from "@/app/context/LocalizationContext"

const AREA_EMOJI: Record<WorkspaceArea, string> = {
  marketing: "📣",
  sales: "🤝",
  automation: "⚡",
  reports: "📑",
}

/** Legacy sidebar: emoji inside bordered tile via MenuItem → EmojiIcon */
const NAV_ITEM_EMOJI: Record<string, string> = {
  campaigns: "🎯",
  segments: "🏷️",
  content: "📄",
  assets: "📁",
  context: "🏢",
  agentsConfiguration: "✨",
  sales: "💰",
  leads: "👥",
  deals: "🤝",
  chat: "💬",
  people: "🔍",
  controlCenter: "🚀",
  requirements: "✅",
  channels: "📡",
  activities: "📋",
  skills: "🧩",
  reportPerformance: "📈",
  reportOverview: "📋",
  reportAnalytics: "🔎",
  reportTraffic: "🌐",
  reportCosts: "📊",
  reportSales: "💵",
}

function reportItemTitle(item: AreaNavItem, t: (k: string) => string): string {
  if (item.dashboardTab) {
    return t(`dashboard.tabs.${item.dashboardTab}`) || item.dashboardTab
  }
  if (item.settingsTab === "channels") {
    return t("settings.tabs.channels") || "Agent Channels"
  }
  if (item.settingsTab === "activities") {
    return t("settings.tabs.activities") || "Activities"
  }
  if (item.key === "skills") {
    return t("settings.tabs.skills") || "Code agent skills"
  }
  if (item.key === "reportCosts") {
    return t("layout.sidebar.costs") || "Cost reports"
  }
  return t(`layout.sidebar.${item.key}`) || item.key
}

interface NavigationAreaGroupsProps {
  renderCollapsed: boolean
  /** Defaults to main scroll areas (Marketing, Sales, Reports) */
  areaOrder?: WorkspaceArea[]
}

export function NavigationAreaGroups({
  renderCollapsed,
  areaOrder = SIDEBAR_SCROLL_AREA_ORDER,
}: NavigationAreaGroupsProps) {
  const { t } = useLocalization()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchQueryString = searchParams.toString()
  const navSearchParams = useMemo(
    () => new URLSearchParams(searchQueryString),
    [searchQueryString]
  )

  const isPathInArea = useCallback(
    (area: WorkspaceArea) => isAreaActive(area, pathname, navSearchParams),
    [pathname, navSearchParams]
  )

  const [open, setOpen] = useState<Record<WorkspaceArea, boolean>>({
    marketing: false,
    sales: false,
    automation: false,
    reports: false,
  })

  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev }
      let changed = false
      for (const area of areaOrder) {
        if (isPathInArea(area) && !next[area]) {
          next[area] = true
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [isPathInArea, areaOrder])

  const toggleArea = (area: WorkspaceArea) => {
    setOpen((prev) => ({ ...prev, [area]: !prev[area] }))
  }

  const renderBadge = (href: string) => {
    if (href === "/control-center")
      return (
        <ControlCenterBadge isActive={pathname.startsWith("/control-center")} />
      )
    if (href === "/content")
      return <ContentBadge isActive={pathname.startsWith("/content")} />
    if (href === "/requirements")
      return (
        <RequirementsBadge isActive={pathname.startsWith("/requirements")} />
      )
    if (href === "/leads")
      return <LeadsBadge isActive={pathname.startsWith("/leads")} />
    if (href === "/chat")
      return <ChatsBadge isActive={pathname.startsWith("/chat")} />
    if (href === "/campaigns")
      return <CampaignsBadge isActive={pathname.startsWith("/campaigns")} />
    return null
  }

  const renderItem = (item: AreaNavItem) => {
    const emoji = NAV_ITEM_EMOJI[item.key]
    if (!emoji) return null
    const linkHref = buildNavItemHref(item)
    const isActive = isNavItemActive(item, pathname, navSearchParams)
    const title = reportItemTitle(item, t)
    return (
      <MenuItem
        key={item.key}
        href={linkHref}
        emoji={emoji}
        title={title}
        isActive={isActive}
        isCollapsed={renderCollapsed}
      >
        {renderBadge(item.href)}
      </MenuItem>
    )
  }

  const tooltipContentClass =
    "flex flex-col gap-1 bg-popover text-popover-foreground dark:border-white/5 border-black/5 shadow-lg z-[9999]"

  return (
    <TooltipProvider delayDuration={100}>
      <div
        className={cn(
          "flex flex-col space-y-1",
          renderCollapsed && "w-full items-center px-0"
        )}
      >
        {areaOrder.map((area) => {
          const config = NAVIGATION_AREAS[area]
          const title = t(config.categoryKey) || area
          const expanded = open[area]

          const sectionToggleButton = (
            <button
              type="button"
              className={cn(
                "group flex items-center rounded-md font-inter transition-colors duration-200 hover:bg-accent hover:text-accent-foreground",
                expanded ? "text-foreground" : "text-muted-foreground",
                renderCollapsed
                  ? "mx-auto h-[32px] w-[32px] shrink-0 justify-center"
                  : "h-[32px] w-full justify-start text-left text-sm"
              )}
              style={
                !renderCollapsed
                  ? {
                      fontSize: "11.3px",
                      paddingLeft: 9.7,
                      paddingRight: 9.7,
                      paddingTop: 6.5,
                      paddingBottom: 6.5,
                      gap: 9.7,
                    }
                  : undefined
              }
              onClick={() => toggleArea(area)}
              aria-expanded={expanded}
              aria-label={title}
            >
              <div
                className={cn(
                  "flex flex-shrink-0 items-center justify-center safari-icon-fix",
                  renderCollapsed ? "h-full w-full" : "h-[24px] w-[24px]"
                )}
              >
                <EmojiIcon
                  emoji={AREA_EMOJI[area]}
                  isActive={expanded}
                  isCollapsed={renderCollapsed}
                  tone="section"
                />
              </div>
              {!renderCollapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate" style={{ lineHeight: "normal" }}>
                    {title}
                  </span>
                  <span
                    className={cn(
                      "sidebar-section-chevron flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-transform",
                      expanded
                        ? "rotate-90 text-foreground group-hover:text-foreground"
                        : "text-muted-foreground/70 group-hover:text-accent-foreground"
                    )}
                  >
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 6 10"
                      className="sidebar-section-chevron-svg"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M1 1L5 5L1 9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </>
              )}
            </button>
          )

          return (
            <div
              key={area}
              className={cn(
                "relative p-1",
                expanded 
                  ? "rounded-[14px] border dark:border-white/10 border-black/5 bg-black/[0.02] dark:bg-white/[0.02]" 
                  : "border border-transparent",
                renderCollapsed ? "w-[42px] mx-auto flex flex-col items-center" : "w-full"
              )}
            >
              {renderCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>{sectionToggleButton}</TooltipTrigger>
                  <TooltipContent side="right" align="start" sideOffset={5} className={tooltipContentClass}>
                    <p className="font-medium">{title}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                sectionToggleButton
              )}

            <div
              className={cn(
                "transition-all duration-300 ease-in-out w-full",
                expanded ? "max-h-[880px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"
              )}
            >
              <div
                className={cn(
                  "flex flex-col space-y-1 pb-1 pt-1",
                  renderCollapsed ? "items-center px-0 w-full" : "px-1"
                )}
              >
                {config.items.map((item) => renderItem(item))}
              </div>
            </div>
          </div>
        )
      })}
      </div>
    </TooltipProvider>
  )
}
