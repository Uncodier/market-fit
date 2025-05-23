"use client"

import { cn } from "@/lib/utils"
import { Settings, Bell, Shield, LogOut, Sun, Moon, CreditCard } from "@/app/components/ui/icons"
import { MenuItem } from "./MenuItem"
import { NotificationBadge } from "./NotificationBadge"
import { usePathname } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Switch } from "@/app/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip"
import { useTheme } from "@/app/context/ThemeContext"
import { type LucideIcon } from "@/app/components/ui/icons"

interface ConfigurationSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed?: boolean
}

interface ConfigItem {
  title: string;
  href: string;
  icon: LucideIcon;
  isSettingsChild?: boolean;
}

const configItems: ConfigItem[] = [
  {
    title: "Notifications",
    href: "/notifications",
    icon: Bell,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
  {
    title: "Billing",
    href: "/billing",
    icon: CreditCard,
    isSettingsChild: true,
  },
  {
    title: "Security",
    href: "/security",
    icon: Shield,
    isSettingsChild: true,
  },
  {
    title: "Theme",
    href: "#theme",
    icon: Sun,
    isSettingsChild: true,
  },
  {
    title: "Log out",
    href: "#logout",
    icon: LogOut,
    isSettingsChild: true,
  },
]

// Lista de cookies de Supabase que necesitamos eliminar
const SUPABASE_COOKIES = [
  'sb-access-token',
  'sb-refresh-token',
  'supabase-auth-token',
  'sb-provider-token',
  'sb-auth-token',
  'sb:token',
  'sb-token',
  'sb-refresh',
  'sb-auth',
  'sb-provider'
]

// Lista de claves de localStorage que podrían contener datos de sesión
const LOCAL_STORAGE_KEYS = [
  'supabase.auth.token',
  'supabase.auth.refreshToken',
  'supabase.auth.user',
  'supabase.auth.expires',
  'supabase.auth.provider',
  'sb-provider-token',
  'sb-access-token',
  'sb-refresh-token',
  'supabase-auth'
]

export function ConfigurationSection({ className, isCollapsed }: ConfigurationSectionProps) {
  const pathname = usePathname()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isChanging, setIsChanging] = useState(false)
  // Create a dummy element ref that we'll use for focus management
  const dummyFocusRef = useRef<HTMLDivElement>(null);
  
  // Use theme context instead of local state
  const { isDarkMode, toggleTheme } = useTheme()
  
  // Check if Settings is active or if any settings child is active
  const isSettingsActive = pathname.startsWith('/settings')
  const isSecurityActive = pathname.startsWith('/security')
  const isBillingActive = pathname.startsWith('/billing')
  
  // Allow manual override for the menu
  const [forceShowChildren, setForceShowChildren] = useState(false)
  const shouldShowSettingsChildren = isSettingsActive || isSecurityActive || isBillingActive || forceShowChildren
  
  // For animation - defining all state upfront
  const [isEntering, setIsEntering] = useState(false)
  const settingsSectionRef = useRef<HTMLDivElement>(null)
  const prevPathRef = useRef(pathname)
  
  // Reset forceShowChildren when navigating between routes
  useEffect(() => {
    const previousPath = prevPathRef.current;
    const isLeavingSettingsArea = (
      (previousPath.startsWith('/settings') || 
       previousPath.startsWith('/security') || 
       previousPath.startsWith('/billing')) &&
      !isSettingsActive && !isSecurityActive && !isBillingActive
    );
    
    // When navigating away from settings area, hide the settings children
    if (isLeavingSettingsArea) {
      setForceShowChildren(false);
    }
    
    // Update previous path reference
    prevPathRef.current = pathname;
  }, [pathname, isSettingsActive, isSecurityActive, isBillingActive]);
  
  // Handle toggling settings menu
  const toggleSettingsMenu = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    // If already in settings area, don't toggle
    if (isSettingsActive || isSecurityActive || isBillingActive) return;
    
    // Toggle force show without triggering additional animations
    setForceShowChildren(prev => !prev);
  };
  
  // Initial animation on mount if needed
  useEffect(() => {
    if (shouldShowSettingsChildren) {
      setIsEntering(true);
      const timer = setTimeout(() => {
        setIsEntering(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, []);
  
  // Remove debug logs in production
  if (process.env.NODE_ENV !== 'production') {
    useEffect(() => {
      console.log("Current path:", pathname);
      console.log("isSettingsActive:", isSettingsActive);
      console.log("isSecurityActive:", isSecurityActive);
      console.log("isBillingActive:", isBillingActive);
      console.log("shouldShowSettingsChildren:", shouldShowSettingsChildren);
    }, [pathname, isSettingsActive, isSecurityActive, isBillingActive, shouldShowSettingsChildren]);
  }
  
  const removeFocus = () => {
    // First try the dummy element
    if (dummyFocusRef.current) {
      dummyFocusRef.current.focus();
      dummyFocusRef.current.blur();
    }
    
    // Then make sure nothing is focused
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    // Finally, move focus to body as a last resort
    document.body.focus();
  };
  
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)
      toast.loading("Signing out...")
      
      // Cerrar sesión en Supabase del lado del cliente como medida adicional
      const supabase = createClient()
      await supabase.auth.signOut()
      
      // Redirección simple a la API de logout
      window.location.href = '/api/auth/logout'
    } catch (error) {
      console.error("Error logging out:", error)
      toast.error("Error signing out")
      
      // En caso de error, intentar la redirección directa de todos modos
      window.location.href = '/api/auth/logout'
    }
  }

  return (
    <div className={cn("space-y-1 py-4", className)} onMouseDown={(e) => e.preventDefault()}>
      {/* Notifications and Settings are always visible */}
      {configItems.slice(0, 2).map((item, idx) => {
        const isSettings = item.title === "Settings";
        const settingsActive = isSettingsActive || isSecurityActive || isBillingActive;
        
        return (
          <div 
            key={`main-${item.href}`} 
            className={cn(isSettings && "relative")}
            onClick={() => {
              if (isSettings) {
                toggleSettingsMenu();
              }
            }}
          >
            <MenuItem
              href={item.href}
              icon={item.icon}
              title={item.title}
              isActive={item.href !== '/' ? pathname.startsWith(item.href) : pathname === item.href}
              isCollapsed={isCollapsed}
              className={isSettings ? "setting-parent-item" : ""}
            >
              {item.title === "Notifications" && (
                <NotificationBadge />
              )}
            </MenuItem>
            
            {/* Indicator for Settings that it has children */}
            {isSettings && !isCollapsed && (
              <div 
                className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center transition-all duration-300 cursor-pointer rounded-full safari-icon-fix",
                  settingsActive || forceShowChildren
                    ? "transform rotate-90 text-primary" 
                    : "transform rotate-0 text-muted-foreground/70"
                )}
                onClick={toggleSettingsMenu}
              >
                <svg 
                  width="8" 
                  height="8" 
                  viewBox="0 0 6 10" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  className="transition-all duration-300"
                >
                  <path 
                    d="M1 1L5 5L1 9" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />
                </svg>
              </div>
            )}
          </div>
        );
      })}
      
      {/* Container for Settings children with animation */}
      <div 
        ref={settingsSectionRef}
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden", 
          shouldShowSettingsChildren ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}
        style={{
          transitionTimingFunction: shouldShowSettingsChildren 
            ? 'cubic-bezier(0.4, 0, 0.2, 1)' // ease-out for showing
            : 'cubic-bezier(0.4, 0, 1, 1)'    // ease-in for hiding (faster)
        }}
      >
        {/* Settings children items */}
        {configItems.slice(2).map((item, index) => {
          const isActive = pathname.startsWith(item.href);
          const isLogout = item.href === "#logout";
          const isTheme = item.href === "#theme";
          
          // Para elementos especiales que no navegarán realmente
          if (isTheme) {
            return (
              <div 
                key={`child-${item.href}`}
                className={cn("relative")}
              >
                <MenuItem
                  href="#"
                  icon={isDarkMode ? Moon : Sun}
                  title={isDarkMode ? "Dark Mode" : "Light Mode"}
                  isActive={false}
                  isCollapsed={isCollapsed}
                  className={cn(
                    !isCollapsed ? "ml-6" : "",
                    "flex items-center"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    toggleTheme();
                  }}
                >
                  {!isCollapsed && (
                    <div className="ml-auto flex items-center">
                      <Switch
                        checked={isDarkMode}
                        onCheckedChange={toggleTheme}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        aria-label={isDarkMode ? "Disable dark mode" : "Enable dark mode"}
                        className="data-[state=checked]:bg-primary/90 focus:outline-none focus:ring-0"
                        style={{ outline: 'none' }}
                      />
                    </div>
                  )}
                </MenuItem>
              </div>
            );
          }
          
          return (
            <div 
              key={`child-${item.href}`}
              className={cn("relative")}
              onClick={(e) => {
                if (isLogout) {
                  e.preventDefault();
                  handleLogout();
                }
              }}
            >
              <MenuItem
                href={isLogout ? "#" : item.href}
                icon={item.icon}
                title={isLogout ? (isLoggingOut ? "Signing out..." : "Log out") : item.title}
                isActive={!isLogout && isActive}
                isCollapsed={isCollapsed}
                className={!isCollapsed ? "ml-6" : ""}
              />
            </div>
          );
        })}
      </div>
      
      {/* Hidden element for focus management - moved to the bottom */}
      <div 
        ref={dummyFocusRef} 
        tabIndex={-1} 
        aria-hidden="true"
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      />
    </div>
  )
} 