"use client"

import { cn } from "@/lib/utils"
import { User, Bell, LayoutGrid, PanelLeftOpen } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { useEffect, useState, useRef, Suspense } from "react"
import dynamic from "next/dynamic"
import { usePathname, useRouter } from "next/navigation"
import { ConfigurationSection } from "./ConfigurationSection"
import { MenuItem } from "./MenuItem"
import { SiteSelector } from "./SiteSelector"
import { NotificationBadge } from "./NotificationBadge"
import { RobotsNavItems } from "./RobotsNavItems"
import { DynamicShortcuts } from "./DynamicShortcuts"
import { useAuth } from "@/app/hooks/use-auth"
import { navigateOrAssign } from "@/lib/navigation/stale-router"
import { SidebarBrand } from "./SidebarBrand"
import { useLocalization } from "@/app/context/LocalizationContext"
import { NavigationAreaGroups } from "./NavigationAreaGroups"
import { SIDEBAR_AUTOMATION_AREA_ORDER } from "@/app/config/navigation-areas"
import { OnboardingProgressWidget } from "./OnboardingProgressWidget"
import { SidebarBillingWidget } from "./SidebarBillingWidget"
import { StartupTrialWidget } from "./StartupTrialWidget"
import { useSidebarEdgeReveal } from "./use-sidebar-edge-reveal"
import { WORKSPACE_SIDEBAR_ACTION, type WorkspaceSidebarMode } from "./workspace-sidebar-mode"

const NavigationPage = dynamic(() => import("@/app/navigation/page"), {
  ssr: false,
})

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  desktopVisible?: boolean
  isMobile?: boolean
  isCollapsed: boolean
  sidebarMode?: WorkspaceSidebarMode
  route?: string
  revealForTour?: boolean
  onCollapse: () => void
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

const profileMainItem = { key: "account", href: "/profile", icon: User }

export function Sidebar({
  className,
  desktopVisible = true,
  isMobile = false,
  isCollapsed,
  sidebarMode,
  route,
  revealForTour = false,
  onCollapse,
  isMobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const { t } = useLocalization()
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()

  const renderCollapsed = isMobileOpen ? false : isCollapsed
  const renderMobile = isMobile || isMobileOpen
  const autoHide = sidebarMode === "hidden" && !renderMobile
  const { revealed: edgeRevealed, dismiss: dismissEdgeReveal } = useSidebarEdgeReveal(autoHide && desktopVisible, route ?? pathname)
  const sidebarHidden = autoHide && !edgeRevealed && !revealForTour

  const [forceShowSettingsChildren, setForceShowSettingsChildren] = useState(false)
  const prevPathSettingsRef = useRef(pathname)

  useEffect(() => {
    const previousPath = prevPathSettingsRef.current
    const inSettingsArea =
      pathname.startsWith("/settings") ||
      pathname.startsWith("/security") ||
      pathname.startsWith("/billing") ||
      pathname.startsWith("/integrations")
    const prevIn =
      previousPath.startsWith("/settings") ||
      previousPath.startsWith("/security") ||
      previousPath.startsWith("/billing") ||
      previousPath.startsWith("/integrations")
    if (prevIn && !inSettingsArea) {
      setForceShowSettingsChildren(false)
    }
    prevPathSettingsRef.current = pathname
  }, [pathname])

  const handleSectionNavigation = (
    e: React.MouseEvent,
    href: string,
    section: "settings" | "profile"
  ) => {
    e.preventDefault()
    e.stopPropagation()

    const inSettingsArea =
      pathname.startsWith("/settings") ||
      pathname.startsWith("/security") ||
      pathname.startsWith("/billing") ||
      pathname.startsWith("/integrations")

    if (section === "settings") {
      if (href === "/settings" && pathname.startsWith("/settings")) {
        navigateOrAssign(router, href)
        return
      }

      if (!inSettingsArea) {
        setForceShowSettingsChildren(true)
        setTimeout(() => {
          navigateOrAssign(router, href)
        }, 400)
      } else {
        navigateOrAssign(router, href)
      }
    } else if (section === "profile") {
      navigateOrAssign(router, href)
    }
  }

  const handleSettingsNavigation = (e: React.MouseEvent, href: string) => {
    handleSectionNavigation(e, href, "settings")
  }

  const handleProfileNavigation = (e: React.MouseEvent, href: string) => {
    handleSectionNavigation(e, href, "profile")
  }

  const [settingsMenuExpanded, setSettingsMenuExpanded] = useState(
    pathname.startsWith("/settings") ||
      pathname.startsWith("/security") ||
      pathname.startsWith("/billing") ||
      pathname.startsWith("/integrations")
  )
  const hideSidebarWidgets = settingsMenuExpanded

  const [isAppsLauncherOpen, setIsAppsLauncherOpen] = useState(false)

  useEffect(() => {
    if (!isMobileOpen || !onMobileClose) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || document.querySelector("[data-site-selector-dialog][data-state=open]")) return
      if (isAppsLauncherOpen) setIsAppsLauncherOpen(false)
      else onMobileClose()
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isMobileOpen, isAppsLauncherOpen, onMobileClose])

  useEffect(() => {
    setIsAppsLauncherOpen(false)
  }, [pathname])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.shiftKey ||
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "a"
      ) return

      const isEditing = [event.target, document.activeElement].some((element) =>
        element instanceof HTMLElement && (
          element.matches("input, textarea, select") ||
          element.isContentEditable ||
          element.closest('[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]') !== null
        )
      )
      if (isEditing) return

      event.preventDefault()
      if (!event.repeat) setIsAppsLauncherOpen(true)
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleAppsClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsAppsLauncherOpen(true)
  }

  return (
    <>
      {isAppsLauncherOpen && (
        <div 
          className="fixed inset-0 z-[300] bg-background/95 backdrop-blur-md flex flex-col animate-in fade-in duration-200"
          onClick={() => setIsAppsLauncherOpen(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="w-full h-full flex flex-col"
          >
            <NavigationPage isOverlay onClose={() => setIsAppsLauncherOpen(false)} />
          </div>
        </div>
      )}
      {isMobileOpen && (
        <div
          data-mobile-sidebar-backdrop
          className="fixed inset-0 bg-black/50 z-[220] md:hidden backdrop-blur-sm transition-opacity"
          aria-hidden="true"
          onClick={onMobileClose}
        />
      )}
      <div
        id="workspace-sidebar"
        data-collapsed={renderCollapsed}
        data-sidebar-mode={renderMobile ? undefined : sidebarMode}
        inert={sidebarHidden || undefined}
        aria-hidden={sidebarHidden || undefined}
        onClickCapture={(event) => {
          if (edgeRevealed && event.target instanceof Element && event.target.closest("a[href]")) {
            dismissEdgeReveal()
          }
        }}
        className={cn(
          "flex flex-col h-[100dvh] overflow-y-auto overflow-x-hidden overscroll-y-contain md:overflow-hidden",
          isCollapsed ? "md:w-16" : "md:w-64",
          "bg-background/80 text-foreground transition-[width,transform] duration-300 ease-in-out motion-reduce:transition-none border-r dark:border-white/5 border-black/5 backdrop-blur-[5px] font-inter",
          "sidebar-light-bg",
          "fixed left-0 top-0",
          isMobileOpen ? "w-80 max-md:max-w-[calc(100%-2.75rem)] max-md:z-[230] md:z-[210]" : "!hidden md:!flex z-[210]",
          sidebarHidden && "-translate-x-full pointer-events-none",
          className
        )}
      >
        <SidebarBrand isCollapsed={renderCollapsed} />
        {autoHide && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mx-auto my-1 shrink-0"
            aria-label={WORKSPACE_SIDEBAR_ACTION.hidden}
            title={WORKSPACE_SIDEBAR_ACTION.hidden}
            onClick={onCollapse}
          >
            <PanelLeftOpen className="h-4 w-4" aria-hidden={true} />
          </Button>
        )}

        <div
          className={cn(
            "min-h-[71px] flex flex-none items-center border-b dark:border-white/5 border-black/5",
            isMobileOpen && "max-md:px-3 max-md:py-3",
            renderCollapsed && "px-[0.1875rem]"
          )}
        >
          <SiteSelector isCollapsed={renderCollapsed} isMobile={isMobileOpen} />
        </div>

        {/* Mobile scrolls the entire sidebar so footer items remain reachable on short viewports. */}
        <div data-sidebar-shortcut-viewport className="flex-1 shrink-0 overflow-visible md:min-h-0 md:shrink md:overflow-y-auto md:overflow-x-hidden">
          <div data-sidebar-shortcut-content style={{ paddingTop: "21.6px", paddingBottom: "21.6px" }}>
            <div
              className={cn(
                "flex flex-col space-y-1",
                renderCollapsed ? "px-0 items-center w-full" : "px-3"
              )}
            >
              <div className={cn("flex flex-col space-y-1 w-full", renderCollapsed ? "w-14 mx-auto items-center" : "px-1")}>
                <Suspense fallback={<div className="min-h-[64px]" aria-hidden />}>
                  <RobotsNavItems
                    isCollapsed={renderCollapsed}
                    isMobile={renderMobile}
                    onWorkspaceNavigation={() => setIsAppsLauncherOpen(false)}
                  />
                  {(desktopVisible || renderMobile) && (
                    <DynamicShortcuts isCollapsed={renderCollapsed} isMobile={renderMobile} />
                  )}
                </Suspense>
              </div>
            </div>
          </div>
        </div>

        <div
          aria-hidden={hideSidebarWidgets}
          className={cn(
            "flex-none transition-[grid-template-rows,opacity] duration-300 ease-in-out",
            "hidden md:grid",
            hideSidebarWidgets
              ? "grid-rows-[0fr] opacity-0 pointer-events-none"
              : "grid-rows-[1fr] opacity-100"
          )}
        >
          <div
            className={cn(
              "overflow-hidden flex flex-col gap-0 pb-2",
              renderCollapsed && "items-center"
            )}
          >
            {desktopVisible && !hideSidebarWidgets && <>
              <OnboardingProgressWidget isCollapsed={renderCollapsed} />
              <SidebarBillingWidget actorId={user?.is_anonymous ? undefined : user?.id} isCollapsed={renderCollapsed} />
              <StartupTrialWidget isCollapsed={renderCollapsed} />
            </>}
          </div>
        </div>

        <div className="flex-none border-t dark:border-white/5 border-black/5 pb-[env(safe-area-inset-bottom,0px)] md:pb-0">
          <div
            className={cn(
              "flex flex-col space-y-1 py-4",
              renderCollapsed ? "px-0 items-center w-full" : "px-3"
            )}
          >
            <div className="w-full">
              {/*
              <Suspense fallback={<div className="min-h-[40px]" aria-hidden />}>
                <NavigationAreaGroups
                  renderCollapsed={renderCollapsed}
                  areaOrder={SIDEBAR_AUTOMATION_AREA_ORDER}
                />
              </Suspense>
              */}
            </div>
            
            <div className={cn("relative", renderCollapsed ? "w-14 mx-auto flex flex-col items-center" : "w-full px-1")}>
              <MenuItem
                id="tour-apps-nav"
                href="/navigation"
                icon={LayoutGrid}
                moduleImage={{ area: "applications", itemKey: "appsLauncher" }}
                title={t("layout.sidebar.apps") === "layout.sidebar.apps" ? "Apps" : t("layout.sidebar.apps")}
                shortcut="A"
                isActive={pathname.startsWith("/navigation") || isAppsLauncherOpen}
                isCollapsed={renderCollapsed}
                onClick={handleAppsClick}
              />
            </div>

            <ConfigurationSection
              className={cn(
                "!p-0 w-full",
                renderCollapsed ? "px-0 flex flex-col items-center w-full" : "px-0"
              )}
              isCollapsed={renderCollapsed}
              forceShowChildren={forceShowSettingsChildren}
              setForceShowChildren={setForceShowSettingsChildren}
              onSettingsNavigation={handleSettingsNavigation}
              onExpandedChange={setSettingsMenuExpanded}
            />

            <div className={cn("relative", renderCollapsed ? "w-14 mx-auto flex flex-col items-center" : "w-full px-1")}>
              <MenuItem
                href="/notifications"
                icon={Bell}
                moduleImage={{ area: "settings", itemKey: "notifications" }}
                title={t("layout.sidebar.notifications") || "Notifications"}
                isActive={pathname.startsWith("/notifications")}
                isCollapsed={renderCollapsed}
              >
                {(desktopVisible || isMobileOpen) && <NotificationBadge isActive={pathname.startsWith("/notifications")} />}
              </MenuItem>
            </div>
          </div>

          <div className="border-t dark:border-white/5 border-black/5 mt-auto">
            <div
              className={cn(
                "flex flex-col space-y-1 py-4",
                renderCollapsed ? "px-0 items-center w-full" : "px-3"
              )}
            >
              <div className={cn("relative", renderCollapsed ? "w-14 mx-auto flex flex-col items-center" : "w-full px-1")}>
                <MenuItem
                  href={profileMainItem.href}
                  icon={profileMainItem.icon}
                  moduleImage={{ area: "settings", itemKey: "profile" }}
                  title={
                    user?.user_metadata?.full_name ||
                    user?.user_metadata?.name ||
                    user?.email?.split("@")[0] ||
                    t("layout.sidebar.account") ||
                    "Account"
                  }
                  subtitle={user?.email || ""}
                  avatarUrl={
                    user?.user_metadata?.avatar_url || user?.user_metadata?.picture
                  }
                  isActive={pathname.startsWith("/profile")}
                  isCollapsed={renderCollapsed}
                  className="profile-parent-item"
                  onClick={(e) => handleProfileNavigation(e, profileMainItem.href)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
