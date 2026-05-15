"use client"

import { cn } from "@/lib/utils"
import { User, Bell } from "@/app/components/ui/icons"
import { useEffect, useState, useRef, Suspense } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ConfigurationSection } from "./ConfigurationSection"
import { MenuItem } from "./MenuItem"
import { SiteSelector } from "./SiteSelector"
import { NotificationBadge } from "./NotificationBadge"
import { RobotsNavItems } from "./RobotsNavItems"
import { useAuth } from "@/app/hooks/use-auth"
import { markUINavigation } from "@/app/hooks/use-navigation-history"
import { NavigationLink } from "./NavigationLink"
import { useLocalization } from "@/app/context/LocalizationContext"
import { NavigationAreaGroups } from "./NavigationAreaGroups"
import { SIDEBAR_AUTOMATION_AREA_ORDER } from "@/app/config/navigation-areas"
import { OnboardingProgressWidget } from "./OnboardingProgressWidget"
import { CreditsWidget } from "./CreditsWidget"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed: boolean
  onCollapse: () => void
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

const profileMainItem = { key: "account", href: "/profile", icon: User, emoji: "👤" }

export function Sidebar({
  className,
  isCollapsed,
  onCollapse,
  isMobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const { t } = useLocalization()
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()

  const renderCollapsed = isMobileOpen ? false : isCollapsed

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
        markUINavigation()
        router.push(href)
        return
      }

      if (!inSettingsArea) {
        setForceShowSettingsChildren(true)
        setTimeout(() => {
          markUINavigation()
          router.push(href)
        }, 400)
      } else {
        markUINavigation()
        router.push(href)
      }
    } else if (section === "profile") {
      markUINavigation()
      router.push(href)
    }
  }

  const handleSettingsNavigation = (e: React.MouseEvent, href: string) => {
    handleSectionNavigation(e, href, "settings")
  }

  const handleProfileNavigation = (e: React.MouseEvent, href: string) => {
    handleSectionNavigation(e, href, "profile")
  }

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[190] md:hidden backdrop-blur-sm transition-opacity"
          onClick={onMobileClose}
        />
      )}
      <div
        data-collapsed={isCollapsed}
        className={cn(
          "flex flex-col h-[100dvh] overflow-hidden",
          isCollapsed ? "md:w-16" : "md:w-64",
          "bg-background/80 text-foreground transition-[width,transform] duration-300 ease-in-out border-r dark:border-white/5 border-black/5 z-[200] backdrop-blur-[5px] font-inter",
          "sidebar-light-bg",
          "fixed left-0 top-0",
          !isMobileOpen && "-translate-x-full md:translate-x-0",
          isMobileOpen && "translate-x-0",
          className
        )}
      >
        <NavigationLink
          href="/agents"
          className={cn(
            "flex items-center h-16 border-b dark:border-white/5 border-black/5 flex-none",
            renderCollapsed ? "justify-center px-3" : "justify-center px-6"
          )}
        >
          <img
            src={renderCollapsed ? "/images/logo.png" : "/images/combination_mark.png"}
            alt="Market Fit Logo"
            className={cn(
              "transition-all duration-200 object-contain",
              renderCollapsed ? "h-6 w-6" : "h-5 w-auto",
              "dark:brightness-0 dark:invert"
            )}
          />
        </NavigationLink>

        <div
          className={cn(
            "min-h-[71px] flex items-center border-b dark:border-white/5 border-black/5",
            renderCollapsed && "px-[0.1875rem]"
          )}
        >
          <SiteSelector isCollapsed={renderCollapsed} />
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div style={{ paddingTop: "21.6px", paddingBottom: "21.6px" }}>
            <div
              className={cn(
                "flex flex-col space-y-1",
                renderCollapsed ? "px-0 items-center w-full" : "px-3"
              )}
            >
              <div className={cn("flex flex-col space-y-1 w-full", renderCollapsed ? "w-[42px] mx-auto items-center" : "px-1")}>
                <Suspense fallback={<div className="min-h-[64px]" aria-hidden />}>
                  <RobotsNavItems isCollapsed={renderCollapsed} />
                </Suspense>
              </div>
              <div style={{ marginTop: "14px" }} className="w-full">
                <Suspense fallback={<div className="min-h-[48px]" aria-hidden />}>
                  <NavigationAreaGroups renderCollapsed={renderCollapsed} />
                </Suspense>
              </div>
            </div>
          </div>
        </div>

        <div className={cn("flex-none flex flex-col gap-0 pb-2", renderCollapsed && "items-center")}>
          <OnboardingProgressWidget isCollapsed={renderCollapsed} />
          <CreditsWidget isCollapsed={renderCollapsed} />
        </div>

        <div className="flex-none border-t dark:border-white/5 border-black/5">
          <div
            className={cn(
              "flex flex-col space-y-1 py-4",
              renderCollapsed ? "px-0 items-center w-full" : "px-3"
            )}
          >
            <div className="w-full">
              <Suspense fallback={<div className="min-h-[40px]" aria-hidden />}>
                <NavigationAreaGroups
                  renderCollapsed={renderCollapsed}
                  areaOrder={SIDEBAR_AUTOMATION_AREA_ORDER}
                />
              </Suspense>
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
            />

            <div className={cn("relative", renderCollapsed ? "w-[42px] mx-auto flex flex-col items-center" : "w-full px-1")}>
              <MenuItem
                href="/notifications"
                icon={Bell}
                emoji="🔔"
                title={t("layout.sidebar.notifications") || "Notifications"}
                isActive={pathname.startsWith("/notifications")}
                isCollapsed={renderCollapsed}
              >
                <NotificationBadge isActive={pathname.startsWith("/notifications")} />
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
              <div className={cn("relative", renderCollapsed ? "w-[42px] mx-auto flex flex-col items-center" : "w-full px-1")}>
                <MenuItem
                  href={profileMainItem.href}
                  icon={profileMainItem.icon}
                emoji={profileMainItem.emoji}
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
                  className="profile-parent-item ![padding-top:25.2px] ![padding-bottom:25.2px]"
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
