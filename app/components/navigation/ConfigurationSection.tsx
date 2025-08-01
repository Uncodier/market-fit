"use client"

import { cn } from "@/lib/utils"
import { Settings, Shield, Sun, Moon, CreditCard } from "@/app/components/ui/icons"
import { MenuItem } from "./MenuItem"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
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
  forceShowChildren?: boolean
  setForceShowChildren?: (value: boolean) => void
  onSettingsNavigation?: (e: React.MouseEvent, href: string) => void
}

interface ConfigItem {
  title: string;
  href: string;
  icon: LucideIcon;
  isSettingsChild?: boolean;
}

const configItems: ConfigItem[] = [
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
]



export function ConfigurationSection({ 
  className, 
  isCollapsed, 
  forceShowChildren: externalForceShowChildren,
  setForceShowChildren: externalSetForceShowChildren,
  onSettingsNavigation
}: ConfigurationSectionProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isChanging, setIsChanging] = useState(false)
  // Create a dummy element ref that we'll use for focus management
  const dummyFocusRef = useRef<HTMLDivElement>(null);
  
  // Use theme context instead of local state
  const { isDarkMode, toggleTheme } = useTheme()
  
  // Check if Settings is active or if any settings child is active
  const isSettingsActive = pathname.startsWith('/settings')
  const isSecurityActive = pathname.startsWith('/security')
  const isBillingActive = pathname.startsWith('/billing')
  
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
  
  const shouldShowSettingsChildren = isSettingsActive || isSecurityActive || isBillingActive || forceShowChildren
  
  // For animation - defining all state upfront
  const [isEntering, setIsEntering] = useState(false)
  const settingsSectionRef = useRef<HTMLDivElement>(null)
  const prevPathRef = useRef(pathname)
  
  // Reset forceShowChildren when navigating between routes (only if using internal state)
  useEffect(() => {
    // Only manage internal state if no external state is provided
    if (externalForceShowChildren === undefined) {
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
    }
    
    // Update previous path reference
    prevPathRef.current = pathname;
  }, [pathname, isSettingsActive, isSecurityActive, isBillingActive, externalForceShowChildren, setForceShowChildren]);
  
  // Use external navigation handler if provided, fallback to local implementation
  const handleSettingsNavigation = onSettingsNavigation || ((e: React.MouseEvent, href: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // If already in settings area and trying to go to settings, navigate immediately
    if (href === '/settings' && isSettingsActive) {
      router.push(href);
      return;
    }
    
    // If not in settings area, first show children then navigate with delay
    if (!isSettingsActive && !isSecurityActive && !isBillingActive) {
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
  


  return (
    <div className={cn("space-y-1 py-4", className)} onMouseDown={(e) => e.preventDefault()}>
      {/* Settings is always visible */}
      {configItems.slice(0, 1).map((item, idx) => {
        const isSettings = item.title === "Settings";
        const settingsActive = isSettingsActive || isSecurityActive || isBillingActive;
        
        return (
          <div 
            key={`main-${item.href}`} 
            className={cn(isSettings && "relative")}
          >
            <MenuItem
              href={item.href}
              icon={item.icon}
              title={item.title}
              isActive={item.href !== '/' ? pathname.startsWith(item.href) : pathname === item.href}
              isCollapsed={isCollapsed}
              className={isSettings ? "setting-parent-item" : ""}
              onClick={isSettings ? (e) => handleSettingsNavigation(e, item.href) : undefined}
            >

            </MenuItem>
            
            {/* Indicator for Settings that it has children */}
            {isSettings && !isCollapsed && (
              <div 
                className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center transition-all duration-300 cursor-pointer rounded-full safari-icon-fix",
                  isSettingsActive
                    ? "transform rotate-90 text-white" // White when active
                    : settingsActive || forceShowChildren
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
        {configItems.slice(1).map((item, index) => {
          const isActive = pathname.startsWith(item.href);
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
                    !isCollapsed ? "ml-3" : "",
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
            >
              <MenuItem
                href={item.href}
                icon={item.icon}
                title={item.title}
                isActive={isActive}
                isCollapsed={isCollapsed}
                className={!isCollapsed ? "ml-3" : ""}
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