"use client"

import { useMemo } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Home, Star, User } from "@/app/components/ui/icons"
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
  completeMobileWorkspaceTabs,
  resolveMobileWorkspaceTab,
} from "./mobile-workspace-tabs"
import { useMobileWorkspaceTabs } from "./use-mobile-workspace-tabs"
import { useCompactMobileDock } from "./use-compact-mobile-dock"
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

  const visibleTabs = completeMobileWorkspaceTabs(tabs, (key) => !access || access.canAccessNavKey(key))
  const isRobots = pathname === "/robots" || pathname.startsWith("/robots/")
  const route = `${pathname}?${search}`
  const visible = !hasId(route) || (isRobots && isInstanceListView(searchParams))
  const compact = useCompactMobileDock(route, visible)
  const isAgent = isRobots && !["imprenta", "workflow"].includes(searchParams.get("mode") ?? "")
  const agentParams = new URLSearchParams(isRobots ? searchParams.toString() : "")
  agentParams.delete("mode")
  const agentQuery = agentParams.toString()
  const agentHref = agentQuery ? `/robots?${agentQuery}` : "/robots"
  const agentTitle = t("layout.sidebar.agents")
  const profileTitle = t("layout.sidebar.profile")
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture

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
        <Icon className={styles.icon} size={23} strokeWidth={1.7} aria-hidden={true} />
        <span className={styles.label} aria-hidden="true">{title}</span>
      </NavigationLink>
    )
  }

  // Keep tracking open modules while detail screens use the full mobile viewport.
  if (!visible) return null

  return (
    <nav
      data-mobile-workspace-navigation
      data-compact={compact || undefined}
      aria-label="Workspace navigation"
      className={cn(styles.dock, "fixed z-[210] px-2 md:hidden")}
    >
      <div className="grid grid-cols-5 items-center gap-1 py-1">
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
          <Home className={styles.icon} size={25} strokeWidth={1.7} aria-hidden={true} />
          <span className={styles.label} aria-hidden="true">{agentTitle}</span>
        </NavigationLink>
        {renderDynamicTab(2)}
        <NavigationLink
          href="/profile"
          aria-label={profileTitle}
          title={profileTitle}
          aria-current={pathname === "/profile" ? "page" : undefined}
          className={styles.tab}
        >
          <Avatar className={cn(styles.icon, "h-6 w-6")} aria-hidden="true">
            <AvatarImage src={avatarUrl} alt="" />
            <AvatarFallback><User size={16} strokeWidth={1.7} /></AvatarFallback>
          </Avatar>
          <span className={styles.label} aria-hidden="true">{profileTitle}</span>
        </NavigationLink>
      </div>
    </nav>
  )
}