"use client"

import { cn } from "@/lib/utils"
import { Settings, Shield, CreditCard, Plug, Sun, Moon } from "@/app/components/ui/icons"
import { Switch } from "@/app/components/ui/switch"
import { useTheme } from "@/app/context/ThemeContext"
import { MenuItem, EmojiIcon } from "./MenuItem"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { type LucideIcon } from "@/app/components/ui/icons"

const SETTINGS_SECTION_EMOJI = "⚙️"

interface ConfigurationSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed?: boolean
  forceShowChildren?: boolean
  setForceShowChildren?: (value: boolean) => void
  onSettingsNavigation?: (e: React.MouseEvent, href: string) => void
}

interface ConfigItem {
  titleKey: string;
  href: string;
  icon: LucideIcon;
  emoji?: string;
  isSettingsChild?: boolean;
}

const settingsChildItems: ConfigItem[] = [
  {
    titleKey: "settingsGeneral",
    href: "/settings",
    icon: Settings,
    emoji: "🎛️",
    isSettingsChild: true,
  },
  { titleKey: "integrations", href: "/integrations", icon: Plug, emoji: "🔌", isSettingsChild: true },
  { titleKey: "billing", href: "/billing", icon: CreditCard, emoji: "💳", isSettingsChild: true },
  { titleKey: "security", href: "/security", icon: Shield, emoji: "🔒", isSettingsChild: true },
  { titleKey: "theme", href: "#theme", icon: Sun, emoji: "🌓", isSettingsChild: true },
]



export function ConfigurationSection({ 
  className, 
  isCollapsed, 
  forceShowChildren: externalForceShowChildren,
  setForceShowChildren: externalSetForceShowChildren,
  onSettingsNavigation
}: ConfigurationSectionProps) {
  const { t } = useLocalization()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const dummyFocusRef = useRef<HTMLDivElement>(null)
  const { isDarkMode, toggleTheme } = useTheme()

  const settingsUrlTab =
    searchParams.get("tab") || searchParams.get("segment") || ""
  /** On /settings but only via Automation nav (channels / activities) — do not highlight Configuration > Settings */
  const isAutomationOnlySettingsTab =
    settingsUrlTab === "channels" ||
    settingsUrlTab === "activities"
  const isOnSettingsPath = pathname.startsWith("/settings")
  const isSettingsSidebarRouteActive =
    isOnSettingsPath && !isAutomationOnlySettingsTab
  const isSecurityActive = pathname.startsWith('/security')
  const isBillingActive = pathname.startsWith('/billing')
  const isIntegrationsActive = pathname.startsWith('/integrations')
  
  // Use external state if provided, fallback to local state
  const [internalForceShowChildren, setInternalForceShowChildren] = useState(false)
  const forceShowChildren = externalForceShowChildren !== undefined ? externalForceShowChildren : internalForceShowChildren
  
  // Unified setter that handles both external and internal state
  const setForceShowChildren = (value: boolean | ((prev: boolean) => boolean)) => {
    if (externalSetForceShowChildren) {
      // For external control, always use direct boolean value
      const newValue = typeof value === 'function' ? value(forceShowChildren) : value;
      externalSetForceShowChildren(newValue);
    } else {
      // For internal control, can use function or direct value
      setInternalForceShowChildren(value);
    }
  };
  
  const [menuOpen, setMenuOpen] = useState(false)
  const routeDrivenOpen =
    isSettingsSidebarRouteActive ||
    isSecurityActive ||
    isBillingActive ||
    isIntegrationsActive
  const shouldShowSettingsChildren =
    routeDrivenOpen || forceShowChildren || menuOpen

  const settingsSectionRef = useRef<HTMLDivElement>(null)
  const prevPathRef = useRef(pathname)

  useEffect(() => {
    if (!routeDrivenOpen) {
      setMenuOpen(false)
    }
  }, [routeDrivenOpen])

  // Reset forceShowChildren when navigating between routes (only if using internal state)
  useEffect(() => {
    // Only manage internal state if no external state is provided
    if (externalForceShowChildren === undefined) {
      const previousPath = prevPathRef.current
      const isLeavingSettingsArea =
        (previousPath.startsWith("/settings") ||
          previousPath.startsWith("/security") ||
          previousPath.startsWith("/billing") ||
          previousPath.startsWith("/integrations")) &&
        !isOnSettingsPath &&
        !isSecurityActive &&
        !isBillingActive &&
        !isIntegrationsActive

      // When navigating away from settings area, hide the settings children
      if (isLeavingSettingsArea) {
        setForceShowChildren(false)
      }
    }

    // Update previous path reference
    prevPathRef.current = pathname
  }, [
    pathname,
    isOnSettingsPath,
    isSecurityActive,
    isBillingActive,
    isIntegrationsActive,
    externalForceShowChildren,
    setForceShowChildren,
  ])
  
  // Use external navigation handler if provided, fallback to local implementation
  const handleSettingsNavigation = onSettingsNavigation || ((e: React.MouseEvent, href: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // If already in settings area and trying to go to settings, navigate immediately
    if (href === '/settings' && isOnSettingsPath) {
      router.push(href);
      return;
    }
    
    // If not in settings area, first show children then navigate with delay
    if (!isOnSettingsPath && !isSecurityActive && !isBillingActive && !isIntegrationsActive) {
      setForceShowChildren(true);
      
      // Navigate after delay
      setTimeout(() => {
        router.push(href);
      }, 400);
    } else {
      // If already in settings area, navigate immediately
      router.push(href);
    }
  });
  
  const settingsTitle = t("layout.sidebar.settings") || "Settings"
  const tooltipContentClass =
    "flex flex-col gap-1 bg-popover text-popover-foreground dark:border-white/5 border-black/5 shadow-lg z-[9999]"

  const settingsSectionToggleButton = (
    <button
      type="button"
      className={cn(
        "group flex items-center rounded-md font-inter transition-colors duration-200 hover:bg-accent hover:text-accent-foreground",
        shouldShowSettingsChildren ? "text-foreground" : "text-muted-foreground",
        isCollapsed
          ? "mx-auto h-[32px] w-[32px] shrink-0 justify-center"
          : "h-[32px] w-full justify-start text-left text-sm"
      )}
      style={
        !isCollapsed
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
      onClick={() => setMenuOpen((v) => !v)}
      aria-expanded={shouldShowSettingsChildren}
      aria-label={settingsTitle}
    >
      <div
        className={cn(
          "flex flex-shrink-0 items-center justify-center safari-icon-fix",
          isCollapsed ? "h-full w-full" : "h-[24px] w-[24px]"
        )}
      >
        <EmojiIcon
          emoji={SETTINGS_SECTION_EMOJI}
          isActive={shouldShowSettingsChildren}
          isCollapsed={isCollapsed}
          tone="section"
        />
      </div>
      {!isCollapsed && (
        <>
          <span className="min-w-0 flex-1 truncate" style={{ lineHeight: "normal" }}>
            {settingsTitle}
          </span>
          <span
            className={cn(
              "sidebar-section-chevron flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-transform",
              shouldShowSettingsChildren
                ? "rotate-90 text-foreground group-hover:text-foreground"
                : "text-muted-foreground/70 group-hover:text-accent-foreground"
            )}
          >
            <svg
              width="8"
              height="8"
              viewBox="0 0 6 10"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="sidebar-section-chevron-svg"
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
    <TooltipProvider delayDuration={100}>
      <div className={cn("space-y-1", className)} onMouseDown={(e) => e.preventDefault()}>
        <div
          className={cn(
            "relative p-1",
            shouldShowSettingsChildren 
              ? "rounded-[14px] border dark:border-white/10 border-black/5 bg-black/[0.02] dark:bg-white/[0.02]"
              : "border border-transparent",
            isCollapsed ? "w-[42px] mx-auto flex flex-col items-center" : "w-full"
          )}
        >
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>{settingsSectionToggleButton}</TooltipTrigger>
              <TooltipContent side="right" align="start" sideOffset={5} className={tooltipContentClass}>
                <p className="font-medium">{settingsTitle}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            settingsSectionToggleButton
          )}

        <div
          ref={settingsSectionRef}
          className={cn(
            "w-full transition-all duration-300 ease-in-out",
            shouldShowSettingsChildren
              ? "max-h-[640px] opacity-100"
              : "max-h-0 opacity-0 overflow-hidden"
          )}
          style={{
            transitionTimingFunction: shouldShowSettingsChildren
              ? "cubic-bezier(0.4, 0, 0.2, 1)"
              : "cubic-bezier(0.4, 0, 1, 1)",
          }}
        >
          <div
            className={cn(
              "flex flex-col space-y-1 pb-1 pt-1",
              isCollapsed ? "items-center px-0" : "px-1"
            )}
          >
            {settingsChildItems.map((item) => {
              const isTheme = item.href === "#theme"

              if (isTheme) {
                return (
                  <div key="settings-child-theme" className="relative">
                    <MenuItem
                      href="#"
                      icon={isDarkMode ? Moon : Sun}
                      emoji="🌓"
                      title={
                        isDarkMode
                          ? t("layout.sidebar.darkMode") || "Dark Mode"
                          : t("layout.sidebar.lightMode") || "Light Mode"
                      }
                      isActive={false}
                      isCollapsed={isCollapsed}
                      className={!isCollapsed ? "ml-3" : ""}
                      onClick={(e) => {
                        e.preventDefault()
                        toggleTheme()
                      }}
                    >
                      {!isCollapsed && (
                        <div className="ml-auto flex items-center">
                          <Switch
                            checked={isDarkMode}
                            onCheckedChange={toggleTheme}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={
                              isDarkMode ? "Disable dark mode" : "Enable dark mode"
                            }
                            className="data-[state=checked]:bg-primary/90 focus:outline-none focus:ring-0"
                            style={{ outline: "none" }}
                          />
                        </div>
                      )}
                    </MenuItem>
                  </div>
                )
              }

              const isGeneralSettings = item.href === "/settings"
              const isActive = isGeneralSettings
                ? isOnSettingsPath &&
                  (!settingsUrlTab || settingsUrlTab === "general")
                : pathname.startsWith(item.href)

              return (
                <div key={`settings-child-${item.href}`} className="relative">
                  <MenuItem
                    href={item.href}
                    icon={item.icon}
                    emoji={item.emoji}
                    title={t(`layout.sidebar.${item.titleKey}`) || item.titleKey}
                    isActive={isActive}
                    isCollapsed={isCollapsed}
                    className={!isCollapsed ? "ml-3" : ""}
                    onClick={
                      isGeneralSettings
                        ? (e) => handleSettingsNavigation(e, item.href)
                        : undefined
                    }
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
      
      {/* Hidden element for focus management - moved to the bottom */}
      <div 
        ref={dummyFocusRef} 
        tabIndex={-1} 
        aria-hidden="true"
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      />
      </div>
    </TooltipProvider>
  )
}
