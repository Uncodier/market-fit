"use client"

import { useMemo } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Home, LayoutGrid, Star } from "@/app/components/ui/icons"
import { NAV_ITEM_ICON } from "@/app/config/module-visuals"
import { getNavItemTitle } from "@/app/config/navigation-areas"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useLayout } from "@/app/context/LayoutContext"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { useOptionalScreenAccess } from "@/app/context/ScreenAccessContext"
import { cn } from "@/lib/utils"
import { hasId } from "@/lib/navigation/breadcrumb-engine"
import { NavigationLink } from "./NavigationLink"
import {
  resolveMobileWorkspaceTab,
} from "./mobile-workspace-tabs"
import { useMobileWorkspaceTabs } from "./use-mobile-workspace-tabs"
import styles from "./mobile-workspace-navigation.module.css"
import { isInstanceListView } from "@/app/robots/mobile-instance-navigation"

export function MobileWorkspaceNavigation() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t } = useLocalization()
  const { setRobotsViewMode } = useLayout()
  const { currentSite, isLoading: siteLoading } = useSite()
  const { user, isLoading: authLoading } = useAuth()
  const access = useOptionalScreenAccess()
  const search = searchParams.toString()
  const active = useMemo(() => resolveMobileWorkspaceTab(pathname, search), [pathname, search])
  const allowedActive = active && (!access || access.canAccessNavKey(active.key)) ? active : null
  const ready = !siteLoading && !authLoading
  const tabs = useMobileWorkspaceTabs(ready ? user?.id : undefined, ready ? currentSite?.id : undefined, allowedActive)

  const visibleTabs = tabs.filter((tab) => !access || access.canAccessNavKey(tab.key))
  const isRobots = pathname === "/robots" || pathname.startsWith("/robots/")
  const isAgent = isRobots && !["imprenta", "workflow"].includes(searchParams.get("mode") ?? "")
  const agentParams = new URLSearchParams(isRobots ? searchParams.toString() : "")
  agentParams.delete("mode")
  const agentQuery = agentParams.toString()
  const agentHref = agentQuery ? `/robots?${agentQuery}` : "/robots"
  const appsActive = pathname === "/navigation"
  const agentTitle = t("layout.sidebar.agents")
  const appsTitle = t("layout.sidebar.apps")

  function activateAgent() {
    setRobotsViewMode("agent")
    window.dispatchEvent(new CustomEvent("navigation-history:reset"))
  }

  function renderDynamicTab(index: number) {
    const tab = visibleTabs[index]
    if (!tab) return <div aria-hidden="true" />
    const Icon = NAV_ITEM_ICON[tab.key] ?? Star
    const title = getNavItemTitle(tab.item, t)
    return (
      <NavigationLink
        href={tab.href}
        aria-label={title}
        title={title}
        aria-current={active?.key === tab.key ? "page" : undefined}
        className={styles.tab}
        onNavigate={() => {
          if (tab.item.robotsMode === "imprenta" || tab.item.robotsMode === "workflow") {
            setRobotsViewMode(tab.item.robotsMode)
          }
        }}
      >
        <Icon size={23} strokeWidth={1.7} aria-hidden={true} />
      </NavigationLink>
    )
  }

  // Keep tracking open modules while detail screens use the full mobile viewport.
  if (hasId(`${pathname}?${search}`) && !(isRobots && isInstanceListView(searchParams))) return null

  return (
    <nav
      data-mobile-workspace-navigation
      aria-label="Workspace navigation"
      className={cn(styles.glass, "fixed z-[210] px-2 md:hidden")}
    >
      <div className="grid h-16 grid-cols-5 items-center gap-1">
        {renderDynamicTab(0)}
        {renderDynamicTab(1)}
        <NavigationLink
          href={agentHref}
          aria-label={agentTitle}
          title={agentTitle}
          aria-current={isAgent ? "page" : undefined}
          onNavigate={activateAgent}
          className={styles.tab}
        >
          <Home size={25} strokeWidth={1.7} aria-hidden={true} />
        </NavigationLink>
        {renderDynamicTab(2)}
        <NavigationLink
          href="/navigation"
          aria-label={appsTitle}
          title={appsTitle}
          aria-current={appsActive ? "page" : undefined}
          className={styles.tab}
        >
          <LayoutGrid size={23} strokeWidth={1.7} aria-hidden={true} />
        </NavigationLink>
      </div>
    </nav>
  )
}