"use client"

import { cn } from "@/lib/utils"
import {
  LayoutGrid,
  FlaskConical,
  CheckSquare,
  Users,
  User,
  MessageSquare,

  Home,
  FolderOpen,
  Bell,
  FileText,
  Target,
  Tag,
  CreditCard,
  DollarSign,
  Rocket,
  LogOut
} from "@/app/components/ui/icons"
import { useEffect, useState, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ConfigurationSection } from "./ConfigurationSection"
import { MenuItem } from "./MenuItem"
import { SiteSelector } from "./SiteSelector"
import { LeadsBadge } from "./LeadsBadge"
import { ControlCenterBadge } from "./ControlCenterBadge"
import { ContentBadge } from "./ContentBadge"
import { RequirementsBadge, CampaignsBadge } from "./RequirementsBadge"
import { ChatsBadge } from "./ChatsBadge"
import { NotificationBadge } from "./NotificationBadge"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/app/hooks/use-auth"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

// Add Cpu icon for AI representation
const Cpu = ({ className = "", ...props }: { className?: string, [key: string]: any }) => (
  <svg 
    viewBox="0 0 24 24" 
    width="18" 
    height="18" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
    <rect x="9" y="9" width="6" height="6" />
    <line x1="9" y1="1" x2="9" y2="4" />
    <line x1="15" y1="1" x2="15" y2="4" />
    <line x1="9" y1="20" x2="9" y2="23" />
    <line x1="15" y1="20" x2="15" y2="23" />
    <line x1="20" y1="9" x2="23" y2="9" />
    <line x1="20" y1="14" x2="23" y2="14" />
    <line x1="1" y1="9" x2="4" y2="9" />
    <line x1="1" y1="14" x2="4" y2="14" />
  </svg>
)

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed: boolean
  onCollapse: () => void
}

// Main navigation items (always visible at top)
const mainNavigationItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
]

// Human in the Loop category
const humanInTheLoopItems = [
  {
    title: "Control Center",
    href: "/control-center",
    icon: Rocket,
  },
  {
    title: "Content",
    href: "/content",
    icon: FileText,
  },
  {
    title: "Requirements",
    href: "/requirements",
    icon: CheckSquare,
  },
  {
    title: "Chats",
    href: "/chat",
    icon: MessageSquare,
  },
]

// Automatic category
const automaticItems = [
  {
    title: "Agents",
    href: "/agents",
    icon: Cpu,
  },
]

// Context section - main item
const contextMainItem = {
  title: "Context",
  href: "/context",
  icon: LayoutGrid,
}

// Context children items
const contextChildrenItems = [
  {
    title: "Campaigns",
    href: "/campaigns",
    icon: Target,
  },
  {
    title: "Segments",
    href: "/segments",
    icon: Tag,
  },
  {
    title: "Assets",
    href: "/assets",
    icon: FolderOpen,
  },
  {
    title: "Leads",
    href: "/leads",
    icon: Users,
  },
  {
    title: "Sales",
    href: "/sales",
    icon: DollarSign,
  },
]

// Profile section - main item (clicking goes to notifications)
const profileMainItem = {
  title: "Account",
  href: "/notifications",
  icon: User,
}

// Profile children items
const profileChildrenItems = [
  {
    title: "Account",
    href: "/profile",
    icon: User,
  },
  {
    title: "Log out",
    href: "#logout",
    icon: LogOut,
  },
]

// Category header component
const CategoryHeader = ({ title, isCollapsed }: { title: string, isCollapsed: boolean }) => {
  if (isCollapsed) return null
  
  const getEmoji = (title: string) => {
    switch (title) {
      case "Human in the Loop":
        return "💪"
      case "Context":
        return "🤖"
      default:
        return ""
    }
  }
  
  return (
    <div className="px-3" style={{ paddingTop: '7.2px', paddingBottom: '7.2px' }}>
      <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2" style={{ fontSize: '10.8px' }}>
        <span className="text-sm">{getEmoji(title)}</span>
        {title}
      </h3>
    </div>
  )
}

export function Sidebar({ 
  className, 
  isCollapsed, 
  onCollapse 
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  
  // Context section state
  const [forceShowContextChildren, setForceShowContextChildren] = useState(false)
  
  // Settings section state (to coordinate with ConfigurationSection)
  const [forceShowSettingsChildren, setForceShowSettingsChildren] = useState(false)
  
  // Profile section state
  const [forceShowProfileChildren, setForceShowProfileChildren] = useState(false)
  
  // Check if Context or any context child is active
  const isContextActive = pathname.startsWith('/context')
  const isCampaignsActive = pathname.startsWith('/campaigns')
  const isSegmentsActive = pathname.startsWith('/segments')
  const isAssetsActive = pathname.startsWith('/assets')
  const isLeadsActive = pathname.startsWith('/leads')
  const isSalesActive = pathname.startsWith('/sales')
  
  const shouldShowContextChildren = isContextActive || isCampaignsActive || isSegmentsActive || 
    isAssetsActive || isLeadsActive || isSalesActive || forceShowContextChildren
  
  // Check if Profile or any profile child is active
  const isProfileActive = pathname.startsWith('/profile')
  const isNotificationsActive = pathname.startsWith('/notifications')
  
  // Profile children should be open when in profile/notifications area or forced
  const shouldShowProfileChildren = isProfileActive || isNotificationsActive || forceShowProfileChildren
  
  // For tracking previous path to handle context menu closing
  const prevPathContextRef = useRef(pathname)
  
  // Reset sections when navigating between routes
  useEffect(() => {
    const previousPath = prevPathContextRef.current;
    
    const inContextArea = isContextActive || isCampaignsActive || isSegmentsActive || 
                          isAssetsActive || isLeadsActive || isSalesActive;
    const inSettingsArea = pathname.startsWith('/settings') || pathname.startsWith('/security') || pathname.startsWith('/billing');
    const inProfileArea = isProfileActive;
    
    const isLeavingContextArea = (
      (previousPath.startsWith('/context') || 
       previousPath.startsWith('/campaigns') || 
       previousPath.startsWith('/segments') ||
       previousPath.startsWith('/assets') ||
       previousPath.startsWith('/leads') ||
       previousPath.startsWith('/sales')) &&
      !inContextArea
    );
    
    const isLeavingSettingsArea = (
      (previousPath.startsWith('/settings') || 
       previousPath.startsWith('/security') || 
       previousPath.startsWith('/billing')) &&
      !inSettingsArea
    );
    
    const isLeavingProfileArea = (
      (previousPath.startsWith('/profile') || 
       previousPath.startsWith('/notifications')) &&
      !inProfileArea
    );
    
    // When navigating away from context area, hide the context children
    if (isLeavingContextArea) {
      setForceShowContextChildren(false);
    }
    
    // When navigating away from settings area, hide the settings children
    if (isLeavingSettingsArea) {
      setForceShowSettingsChildren(false);
    }
    
    // When navigating away from profile area, hide the profile children
    if (isLeavingProfileArea) {
      setForceShowProfileChildren(false);
    }
    
    // Update previous path reference
    prevPathContextRef.current = pathname;
  }, [pathname, isContextActive, isCampaignsActive, isSegmentsActive, isAssetsActive, isLeadsActive, isSalesActive, isProfileActive, isNotificationsActive]);
  
  // Centralized navigation handler that coordinates all sections
  const handleSectionNavigation = (e: React.MouseEvent, href: string, section: 'context' | 'settings' | 'profile') => {
    e.preventDefault();
    e.stopPropagation();
    
    const inContextArea = isContextActive || isCampaignsActive || isSegmentsActive || 
                          isAssetsActive || isLeadsActive || isSalesActive;
    
    // Check if we're in settings area (we'll need to get this from ConfigurationSection)
    const inSettingsArea = pathname.startsWith('/settings') || pathname.startsWith('/security') || pathname.startsWith('/billing');
    const inProfileArea = isProfileActive || isNotificationsActive;
    
    if (section === 'context') {
      // Always ensure context section is open when clicking on Context
      setForceShowContextChildren(true);
      setForceShowSettingsChildren(false); // Close other sections
      setForceShowProfileChildren(false);
      
      // If already in context area and trying to go to context, navigate immediately
      if (href === '/context' && isContextActive) {
        router.push(href);
        return;
      }
      
      // If not in context area, navigate with delay to show animation
      if (!inContextArea) {
        setTimeout(() => {
          router.push(href);
        }, 400);
      } else {
        // If already in context area, navigate immediately
        router.push(href);
      }
    } else if (section === 'settings') {
      // If already in settings area and trying to go to settings, navigate immediately
      if (href === '/settings' && pathname.startsWith('/settings')) {
        router.push(href);
        return;
      }
      
      // If not in settings area, show settings children and hide other sections immediately
      if (!inSettingsArea) {
        setForceShowSettingsChildren(true);
        setForceShowContextChildren(false); // Close context immediately
        setForceShowProfileChildren(false); // Close profile immediately
        
        // Navigate after delay
        setTimeout(() => {
          router.push(href);
        }, 400);
      } else {
        // If already in settings area, navigate immediately
        router.push(href);
      }
    } else if (section === 'profile') {
      // If already in profile area and trying to go to profile, navigate immediately
      if (href === '/profile' && isProfileActive) {
        router.push(href);
        return;
      }
      
      // If not in profile area, show profile children and hide other sections immediately
      if (!inProfileArea) {
        setForceShowProfileChildren(true);
        setForceShowContextChildren(false); // Close context immediately
        setForceShowSettingsChildren(false); // Close settings immediately
        
        // Navigate after delay
        setTimeout(() => {
          router.push(href);
        }, 400);
      } else {
        // If already in profile area, navigate immediately
        router.push(href);
      }
    }
  };
  
  // Handle context menu navigation with delay
  const handleContextNavigation = (e: React.MouseEvent, href: string) => {
    handleSectionNavigation(e, href, 'context');
  };
  
  // Handle settings menu navigation with delay (to be passed to ConfigurationSection)
  const handleSettingsNavigation = (e: React.MouseEvent, href: string) => {
    handleSectionNavigation(e, href, 'settings');
  };
  
  // Handle profile menu navigation with delay
  const handleProfileNavigation = (e: React.MouseEvent, href: string) => {
    handleSectionNavigation(e, href, 'profile');
  };
  
  // Handle toggling context menu
  const toggleContextMenu = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    // If already in context area, don't toggle
    if (isContextActive || isCampaignsActive || isSegmentsActive || 
        isAssetsActive || isLeadsActive || isSalesActive) return;
    
    // Toggle force show
    setForceShowContextChildren(prev => !prev);
  }
  
  // Handle toggling profile menu
  const toggleProfileMenu = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    // If already in profile area, don't toggle
    if (isProfileActive || isNotificationsActive) return;
    
    // Toggle force show
    setForceShowProfileChildren(prev => !prev);
  }

  // Handle logout function
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
    <div
      data-collapsed={isCollapsed}
      className={cn(
        "flex flex-col h-screen",
        isCollapsed ? "w-16" : "w-64",
        "bg-background/80 text-foreground transition-all duration-200 border-r border-border z-40 backdrop-blur-[5px]",
        className
      )}
    >
      {/* Logo Section - Fixed */}
      <Link href="/dashboard" className={cn(
        "flex items-center h-16 border-b border-border flex-none",
        isCollapsed ? "justify-center px-3" : "justify-center px-6"
      )}>
        <Image 
          src={isCollapsed ? "/images/logo.png" : "/images/combination_mark.png"}
          alt="Market Fit Logo"
          width={isCollapsed ? 32 : 120}
          height={isCollapsed ? 32 : 40}
          className={cn(
            "transition-all duration-200 object-contain",
            isCollapsed ? "h-8 w-8" : "h-10 w-auto",
            "dark:hidden"
          )}
          priority
        />
        <Image 
          src={isCollapsed ? "/images/logo.png" : "/images/combination_mark_white.png"}
          alt="Market Fit Logo"
          width={isCollapsed ? 32 : 120}
          height={isCollapsed ? 32 : 40}
          className={cn(
            "transition-all duration-200 object-contain",
            isCollapsed ? "h-8 w-8" : "h-10 w-auto",
            "hidden dark:block"
          )}
          priority
        />
      </Link>

      {/* Site Selector */}
      <div className={cn(
        "min-h-[71px] flex items-center border-b border-border",
        isCollapsed && "px-[0.1875rem]"
      )}>
        <SiteSelector isCollapsed={isCollapsed} />
      </div>

      {/* Navigation Items - Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div style={{ paddingTop: '21.6px', paddingBottom: '21.6px' }}>
          {/* Main Navigation Items */}
          <div className={cn(
            "flex flex-col space-y-1",
            isCollapsed ? "px-[14px]" : "px-3"
          )}>
            {mainNavigationItems.map((item) => (
              <MenuItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                title={item.title}
                isActive={item.href !== '/' ? pathname.startsWith(item.href) : pathname === item.href}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>

          {/* Human in the Loop Category */}
          <div style={{ marginTop: '21.6px' }}>
            <CategoryHeader title="Human in the Loop" isCollapsed={isCollapsed} />
            <div className={cn(
              "flex flex-col space-y-1",
              isCollapsed ? "px-[14px]" : "px-3"
            )}>
              {humanInTheLoopItems.map((item) => (
                <MenuItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  title={item.title}
                  isActive={item.href !== '/' ? pathname.startsWith(item.href) : pathname === item.href}
                  isCollapsed={isCollapsed}
                >
                  {item.title === "Control Center" && (
                    <ControlCenterBadge isActive={pathname.startsWith("/control-center")} />
                  )}
                  {item.title === "Content" && (
                    <ContentBadge isActive={pathname.startsWith("/content")} />
                  )}
                  {item.title === "Requirements" && (
                    <RequirementsBadge isActive={pathname.startsWith("/requirements")} />
                  )}
                  {item.title === "Chats" && (
                    <ChatsBadge isActive={pathname.startsWith("/chat")} />
                  )}
                </MenuItem>
              ))}
            </div>
          </div>

          {/* Automatic Category */}
          <div style={{ marginTop: '21.6px' }}>
            <CategoryHeader title="🤖 Automatic" isCollapsed={isCollapsed} />
            <div className={cn(
              "flex flex-col space-y-1",
              isCollapsed ? "px-[14px]" : "px-3"
            )}>
              {automaticItems.map((item) => (
                <MenuItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  title={item.title}
                  isActive={item.href !== '/' ? pathname.startsWith(item.href) : pathname === item.href}
                  isCollapsed={isCollapsed}
                />
              ))}
            </div>
          </div>


        </div>
      </div>

      {/* Bottom Section - Fixed */}
      <div className="flex-none border-t border-border">
        <div className={cn("flex flex-col space-y-1 py-4", isCollapsed ? "px-[14px]" : "px-3")}>
          {/* Context main item */}
          <div 
            className="relative"
          >
            <MenuItem
              href={contextMainItem.href}
              icon={contextMainItem.icon}
              title={contextMainItem.title}
              isActive={pathname.startsWith(contextMainItem.href)}
              isCollapsed={isCollapsed}
              className="context-parent-item"
              onClick={(e) => handleContextNavigation(e, contextMainItem.href)}
            />
            
            {/* Indicator for Context that it has children */}
            {!isCollapsed && (
              <div 
                className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center transition-all duration-300 cursor-pointer rounded-full safari-icon-fix",
                  pathname.startsWith(contextMainItem.href) 
                    ? "transform rotate-90 text-white" // White when active
                    : shouldShowContextChildren
                      ? "transform rotate-90 text-primary" 
                      : "transform rotate-0 text-muted-foreground/70"
                )}
                onClick={toggleContextMenu}
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
          
          {/* Container for Context children with animation */}
          <div 
            className={cn(
              "transition-all duration-300 ease-in-out", 
              shouldShowContextChildren ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"
            )}
            style={{
              transitionTimingFunction: shouldShowContextChildren 
                ? 'cubic-bezier(0.4, 0, 0.2, 1)' // ease-out for showing
                : 'cubic-bezier(0.4, 0, 1, 1)'    // ease-in for hiding (faster)
            }}
          >
            {/* Context children items */}
            {contextChildrenItems.map((item) => (
              <div key={`context-child-${item.href}`} className="relative">
                <MenuItem
                  href={item.href}
                  icon={item.icon}
                  title={item.title}
                  isActive={pathname.startsWith(item.href)}
                  isCollapsed={isCollapsed}
                  className={!isCollapsed ? "ml-3" : ""}
                >
                  {item.title === "Leads" && (
                    <LeadsBadge isActive={pathname.startsWith("/leads")} />
                  )}
                  {item.title === "Campaigns" && (
                    <CampaignsBadge isActive={pathname.startsWith("/campaigns")} />
                  )}
                </MenuItem>
              </div>
            ))}
          </div>
          
          {/* Settings item - now part of the same list */}
          <ConfigurationSection 
            className={cn("!p-0", isCollapsed ? "px-[14px]" : "px-3")} 
            isCollapsed={isCollapsed}
            forceShowChildren={forceShowSettingsChildren}
            setForceShowChildren={setForceShowSettingsChildren}
            onSettingsNavigation={handleSettingsNavigation}
          />
        </div>
        {/* Profile Section - Collapsible */}
        <div className="border-t border-border">
          <div className={cn("flex flex-col space-y-1 py-4", isCollapsed ? "px-[14px]" : "px-3")}>
            {/* Profile main item */}
            <div 
              className="relative"
            >
              <MenuItem
                href={profileMainItem.href}
                icon={profileMainItem.icon}
                title={user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Account'}
                subtitle={user?.email || ''}
                avatarUrl={user?.user_metadata?.avatar_url || user?.user_metadata?.picture}
                isActive={pathname.startsWith('/notifications')}
                isCollapsed={isCollapsed}
                className="profile-parent-item ![padding-top:25.2px] ![padding-bottom:25.2px]"
                onClick={(e) => handleProfileNavigation(e, profileMainItem.href)}
              />
              
              {/* Notification badge positioned above avatar */}
              {!isCollapsed && (
                <div className="absolute top-0 left-[1.7rem] z-10">
                  <NotificationBadge isActive={pathname.startsWith("/notifications")} />
                </div>
              )}
              
              {/* For collapsed mode, position badge over collapsed avatar */}
              {isCollapsed && (
                <div className="absolute -top-2 right-0.5 z-10">
                  <NotificationBadge isActive={pathname.startsWith("/notifications")} />
                </div>
              )}
              
              {/* Indicator for Profile that it has children */}
              {!isCollapsed && (
                <div 
                  className={cn(
                    "absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center transition-all duration-300 cursor-pointer rounded-full safari-icon-fix",
                    pathname.startsWith('/notifications') 
                      ? "transform rotate-90 text-white" // White when active
                      : shouldShowProfileChildren
                        ? "transform rotate-90 text-primary" 
                        : "transform rotate-0 text-muted-foreground/70"
                  )}
                  onClick={toggleProfileMenu}
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
            
            {/* Container for Profile children with animation */}
            <div 
              className={cn(
                "transition-all duration-300 ease-in-out overflow-hidden", 
                shouldShowProfileChildren ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
              )}
              style={{
                transitionTimingFunction: shouldShowProfileChildren 
                  ? 'cubic-bezier(0.4, 0, 0.2, 1)' // ease-out for showing
                  : 'cubic-bezier(0.4, 0, 1, 1)'    // ease-in for hiding (faster)
              }}
            >
              {/* Profile children items */}
              {profileChildrenItems.map((item) => {
                const isLogout = item.href === "#logout";
                
                return (
                  <div 
                    key={`profile-child-${item.href}`} 
                    className="relative"
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
                      isActive={!isLogout && pathname.startsWith(item.href)}
                      isCollapsed={isCollapsed}
                      className={!isCollapsed ? "ml-3" : ""}
                    >
                    </MenuItem>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 