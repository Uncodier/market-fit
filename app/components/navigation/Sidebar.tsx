"use client"

import { cn } from "@/lib/utils"
import {
  LayoutGrid,
  FlaskConical,
  CheckSquare,
  Users,
  User,
  MessageSquare,
  Bot,
  Home,
  FolderOpen,
  Bell,
  FileText,
  Target,
  Tag,
  CreditCard,
  DollarSign,
  Rocket,
  LogOut,
  Search,
  Briefcase
} from "@/app/components/ui/icons"
import { useEffect, useState, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ConfigurationSection } from "./ConfigurationSection"
import { MenuItem } from "./MenuItem"
import { SiteSelector } from "./SiteSelector"
import { LeadsBadge } from "./LeadsBadge"
import { ControlCenterBadge } from "./ControlCenterBadge"
import { RobotsBadge } from "./RobotsBadge"
import { ContentBadge } from "./ContentBadge"
import { RequirementsBadge, CampaignsBadge } from "./RequirementsBadge"
import { ChatsBadge } from "./ChatsBadge"
import { NotificationBadge } from "./NotificationBadge"
import { useAuth } from "@/app/hooks/use-auth"
import { markUINavigation } from "@/app/hooks/use-navigation-history"
import { NavigationLink } from "./NavigationLink"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useLocalization } from "@/app/context/LocalizationContext"

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
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

// Main navigation items (always visible at top) - key used for i18n
const mainNavigationItems = [
  { key: "dashboard", href: "/dashboard", icon: Home, emoji: "🏠" },
]

// Human in the Loop category
const humanInTheLoopItems = [
  { key: "controlCenter", href: "/control-center", icon: Rocket, emoji: "🚀" },
  { key: "content", href: "/content", icon: FileText, emoji: "📄" },
  { key: "requirements", href: "/requirements", icon: CheckSquare, emoji: "✅" },
  { key: "people", href: "/people", icon: Search, emoji: "🔍" },
  { key: "leads", href: "/leads", icon: Users, emoji: "👥" },
  { key: "deals", href: "/deals", icon: Briefcase, emoji: "🤝" },
  { key: "chat", href: "/chat", icon: MessageSquare, emoji: "💬" },
]

// Robots category
const robotsItems = [
  { key: "robots", href: "/robots", icon: Bot, emoji: "🤖" },
]

// Context section - main item
const contextMainItem = { key: "context", href: "/context", icon: LayoutGrid, emoji: "🏢" }

// Context children items
const contextChildrenItems = [
  { key: "campaigns", href: "/campaigns", icon: Target, emoji: "🎯" },
  { key: "segments", href: "/segments", icon: Tag, emoji: "🏷️" },
  { key: "assets", href: "/assets", icon: FolderOpen, emoji: "📁" },
  { key: "sales", href: "/sales", icon: DollarSign, emoji: "💰" },
]

// Profile section - main item
const profileMainItem = { key: "account", href: "/profile", icon: User, emoji: "👤" }

import { CreditsWidget } from "./CreditsWidget"

// Category header component - titleKey is layout.category.* key
const CategoryHeader = ({ titleKey, title, isCollapsed }: { titleKey?: string, title: string, isCollapsed: boolean }) => {
  const getEmoji = (key: string | undefined) => {
    if (key === "humanInTheLoop") return "💪"
    if (key === "project") return "🏢"
    return ""
  }
  return (
    <div className="px-3" style={{ paddingTop: '7.2px', paddingBottom: '7.2px' }}>
      {!isCollapsed && (
        <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-2" style={{ fontSize: '10.8px' }}>
          <span className="text-sm">{getEmoji(titleKey)}</span>
          {title}
        </h3>
      )}
    </div>
  )
}

export function Sidebar({ 
  className, 
  isCollapsed, 
  onCollapse,
  isMobileOpen = false,
  onMobileClose
}: SidebarProps) {
  const { t } = useLocalization()
  const pathname = usePathname()
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  
  // Force expanded state when mobile menu is open, so content renders correctly in the drawer
  const renderCollapsed = isMobileOpen ? false : isCollapsed

  // Context section state
  const [forceShowContextChildren, setForceShowContextChildren] = useState(false)
  
  // Settings section state (to coordinate with ConfigurationSection)
  const [forceShowSettingsChildren, setForceShowSettingsChildren] = useState(false)
  
  // Check if Context or any context child is active
  const isContextActive = pathname.startsWith('/context')
  const isCampaignsActive = pathname.startsWith('/campaigns')
  const isSegmentsActive = pathname.startsWith('/segments')
  const isAssetsActive = pathname.startsWith('/assets')
  const isDealsActive = pathname.startsWith('/deals')

  const isSalesActive = pathname.startsWith('/sales')
  
  const shouldShowContextChildren = isContextActive || isCampaignsActive || isSegmentsActive || 
    isAssetsActive || isSalesActive || forceShowContextChildren
  
  // For tracking previous path to handle context menu closing
  const prevPathContextRef = useRef(pathname)
  
  // Reset sections when navigating between routes
  useEffect(() => {
    const previousPath = prevPathContextRef.current;
    
    const inContextArea = isContextActive || isCampaignsActive || isSegmentsActive || 
                          isAssetsActive || isSalesActive;
    const inSettingsArea = pathname.startsWith('/settings') || pathname.startsWith('/security') || pathname.startsWith('/billing') || pathname.startsWith('/agents') || pathname.startsWith('/integrations');
    
    const isLeavingContextArea = (
      (previousPath.startsWith('/context') || 
       previousPath.startsWith('/campaigns') || 
       previousPath.startsWith('/segments') ||
       previousPath.startsWith('/assets') ||
       previousPath.startsWith('/leads') ||
       previousPath.startsWith('/deals') ||
       previousPath.startsWith('/sales')) &&
      !inContextArea
    );
    
    const isLeavingSettingsArea = (
      (previousPath.startsWith('/settings') || 
       previousPath.startsWith('/security') || 
       previousPath.startsWith('/billing') ||
       previousPath.startsWith('/agents') ||
       previousPath.startsWith('/integrations')) &&
      !inSettingsArea
    );
    
    // When navigating away from context area, hide the context children
    if (isLeavingContextArea) {
      setForceShowContextChildren(false);
    }
    
    // When navigating away from settings area, hide the settings children
    if (isLeavingSettingsArea) {
      setForceShowSettingsChildren(false);
    }
    
    // Update previous path reference
    prevPathContextRef.current = pathname;
  }, [pathname, isContextActive, isCampaignsActive, isSegmentsActive, isAssetsActive, isSalesActive, isDealsActive]);
  
  // Centralized navigation handler that coordinates all sections
  const handleSectionNavigation = (e: React.MouseEvent, href: string, section: 'context' | 'settings' | 'profile') => {
    e.preventDefault();
    e.stopPropagation();
    
    const inContextArea = isContextActive || isCampaignsActive || isSegmentsActive || 
                          isAssetsActive || isSalesActive;
    
    // Check if we're in settings area (we'll need to get this from ConfigurationSection)
    const inSettingsArea = pathname.startsWith('/settings') || pathname.startsWith('/security') || pathname.startsWith('/billing') || pathname.startsWith('/agents') || pathname.startsWith('/integrations');
  const isProfileActive = pathname.startsWith('/profile')
  const isNotificationsActive = pathname.startsWith('/notifications')
  
  if (section === 'context') {
      // Always ensure context section is open when clicking on Context
      setForceShowContextChildren(true);
      setForceShowSettingsChildren(false); // Close other sections
      
      // If already in context area and trying to go to context, navigate immediately
      if (href === '/context' && isContextActive) {
        markUINavigation();
        router.push(href);
        return;
      }
      
      // If not in context area, navigate with delay to show animation
      if (!inContextArea) {
        setTimeout(() => {
          markUINavigation();
          router.push(href);
        }, 400);
      } else {
        // If already in context area, navigate immediately
        markUINavigation();
        router.push(href);
      }
    } else if (section === 'settings') {
      // If already in settings area and trying to go to settings, navigate immediately
      if (href === '/settings' && pathname.startsWith('/settings')) {
        markUINavigation();
        router.push(href);
        return;
      }
      
      // If not in settings area, show settings children and hide other sections immediately
      if (!inSettingsArea) {
        setForceShowSettingsChildren(true);
        setForceShowContextChildren(false); // Close context immediately
        
        // Navigate after delay
        setTimeout(() => {
          markUINavigation();
          router.push(href);
        }, 400);
      } else {
        // If already in settings area, navigate immediately
        markUINavigation();
        router.push(href);
      }
    } else if (section === 'profile') {
      // Navigate immediately for profile
      markUINavigation();
      router.push(href);
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
        isAssetsActive || isSalesActive) return;
    
    // Toggle force show
    setForceShowContextChildren(prev => !prev);
  }

  return (
    <>
      {/* Mobile Overlay */}
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
        // Mobile styles
        "fixed left-0 top-0",
        !isMobileOpen && "-translate-x-full md:translate-x-0",
        isMobileOpen && "translate-x-0",
        className
      )}
    >
      {/* Logo Section - Fixed */}
      <NavigationLink href="/dashboard" className={cn(
        "flex items-center h-16 border-b dark:border-white/5 border-black/5 flex-none",
        renderCollapsed ? "justify-center px-3" : "justify-center px-6"
      )}>
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

      {/* Site Selector */}
      <div className={cn(
        "min-h-[71px] flex items-center border-b dark:border-white/5 border-black/5",
        renderCollapsed && "px-[0.1875rem]"
      )}>
        <SiteSelector isCollapsed={renderCollapsed} />
      </div>

      {/* Navigation Items - Scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div style={{ paddingTop: '21.6px', paddingBottom: '21.6px' }}>
          {/* Main Navigation Items */}
          <div className={cn(
            "flex flex-col space-y-1",
            renderCollapsed ? "px-[14px] items-center" : "px-3"
          )}>
            {mainNavigationItems.map((item) => (
              <MenuItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                emoji={item.emoji}
                title={t(`layout.sidebar.${item.key}`) || item.key}
                isActive={item.href !== '/' ? pathname.startsWith(item.href) : pathname === item.href}
                isCollapsed={renderCollapsed}
              />
            ))}
          </div>

          {/* Human in the Loop Category */}
          <div style={{ marginTop: '21.6px' }}>
            <div className={cn(
              "flex flex-col space-y-1",
              renderCollapsed ? "px-[14px] items-center" : "px-3"
            )}>
            {humanInTheLoopItems.map((item) => (
                <MenuItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  emoji={item.emoji}
                  title={t(`layout.sidebar.${item.key}`) || item.key}
                  isActive={item.href !== '/' ? pathname.startsWith(item.href) : pathname === item.href}
                  isCollapsed={renderCollapsed}
                >
                  {item.href === "/control-center" && (
                    <ControlCenterBadge isActive={pathname.startsWith("/control-center")} />
                  )}
                  {item.href === "/content" && (
                    <ContentBadge isActive={pathname.startsWith("/content")} />
                  )}
                  {item.href === "/requirements" && (
                    <RequirementsBadge isActive={pathname.startsWith("/requirements")} />
                  )}
                  {item.href === "/leads" && (
                    <LeadsBadge isActive={pathname.startsWith("/leads")} />
                  )}
                  {item.href === "/chat" && (
                    <ChatsBadge isActive={pathname.startsWith("/chat")} />
                  )}
                </MenuItem>
            ))}
            </div>
          </div>

          {/* Robots Category */}
          <div style={{ marginTop: '21.6px' }}>
            <div className={cn(
              "flex flex-col space-y-1",
              renderCollapsed ? "px-[14px] items-center" : "px-3"
            )}>
              {robotsItems.map((item) => (
                <MenuItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  emoji={item.emoji}
                  title={t(`layout.sidebar.${item.key}`) || item.key}
                  isActive={item.href !== '/' ? pathname.startsWith(item.href) : pathname === item.href}
                  isCollapsed={renderCollapsed}
                >
                  {item.href === "/robots" && (
                    <RobotsBadge isActive={pathname.startsWith("/robots")} />
                  )}
                </MenuItem>
              ))}
            </div>
          </div>


        </div>
      </div>

      {/* Credits Widget - Above the bottom fixed section */}
      <div className={cn("flex-none pb-2", renderCollapsed && "flex justify-center")}>
        <CreditsWidget isCollapsed={renderCollapsed} />
      </div>

      {/* Bottom Section - Fixed */}
      <div className="flex-none border-t dark:border-white/5 border-black/5">
        <div className={cn("flex flex-col space-y-1 py-4", renderCollapsed ? "px-[14px] items-center" : "px-3")}>
          {/* Context main item */}
          <div 
            className="relative"
          >
            <MenuItem
              href={contextMainItem.href}
              icon={contextMainItem.icon}
              emoji={contextMainItem.emoji}
              title={t(`layout.sidebar.${contextMainItem.key}`) || contextMainItem.key}
              isActive={pathname.startsWith(contextMainItem.href)}
              isCollapsed={renderCollapsed}
              className="context-parent-item"
              onClick={(e) => handleContextNavigation(e, contextMainItem.href)}
            />
            
            {/* Indicator for Context that it has children */}
            {!renderCollapsed && (
              <div 
                className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center transition-colors duration-300 cursor-pointer rounded-full font-inter safari-icon-fix hover:bg-accent/50",
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
                  className="transition-colors duration-300"
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
                  emoji={item.emoji}
                  title={t(`layout.sidebar.${item.key}`) || item.key}
                  isActive={pathname.startsWith(item.href)}
                  isCollapsed={renderCollapsed}
                  className={!renderCollapsed ? "ml-3" : ""}
                >
                  {item.href === "/campaigns" && (
                    <CampaignsBadge isActive={pathname.startsWith("/campaigns")} />
                  )}
                </MenuItem>
              </div>
            ))}
          </div>
          
          {/* Settings item - now part of the same list */}
          <ConfigurationSection 
            className={cn("!p-0", renderCollapsed ? "px-[14px] flex flex-col items-center" : "px-3")} 
            isCollapsed={renderCollapsed}
            forceShowChildren={forceShowSettingsChildren}
            setForceShowChildren={setForceShowSettingsChildren}
            onSettingsNavigation={handleSettingsNavigation}
          />
          
          {/* Notifications item */}
          <div className={cn("relative mt-2", renderCollapsed ? "w-8 mx-auto" : "w-full")} style={{ marginTop: '0.5rem' }}>
            <MenuItem
              href="/notifications"
              icon={Bell}
              emoji="🔔"
              title={t('layout.sidebar.notifications') || "Notifications"}
              isActive={pathname.startsWith('/notifications')}
              isCollapsed={renderCollapsed}
            >
              <NotificationBadge isActive={pathname.startsWith("/notifications")} />
            </MenuItem>
          </div>
        </div>
        
        {/* Profile Section - Collapsible */}
        <div className="border-t dark:border-white/5 border-black/5 mt-auto">
          <div className={cn("flex flex-col space-y-1 py-4", renderCollapsed ? "px-[14px] items-center" : "px-3")}>
            {/* Profile main item */}
            <div 
              className="relative"
            >
              <MenuItem
                href={profileMainItem.href}
                icon={profileMainItem.icon}
                emoji={profileMainItem.emoji}
                title={user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || (t('layout.sidebar.account') || 'Account')}
                subtitle={user?.email || ''}
                avatarUrl={user?.user_metadata?.avatar_url || user?.user_metadata?.picture}
                isActive={pathname.startsWith('/profile')}
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