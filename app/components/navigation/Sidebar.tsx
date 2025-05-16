"use client"

import { cn } from "@/lib/utils"
import {
  LayoutGrid,
  FlaskConical,
  ClipboardList,
  Users,
  User,
  MessageSquare,
  ChevronRight,
  Home,
  FolderOpen,
  Bell,
  FileText,
  Target,
  Tag,
  CreditCard,
  DollarSign
} from "@/app/components/ui/icons"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { ConfigurationSection } from "./ConfigurationSection"
import { MenuItem } from "./MenuItem"
import { SiteSelector } from "./SiteSelector"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/app/hooks/use-auth"

// Add Cpu icon for AI representation
const Cpu = ({ className = "", size = 18, ...props }: { className?: string, size?: number, [key: string]: any }) => (
  <div 
    className={`inline-flex items-center justify-center safari-icon-fix ${className}`}
    style={{ 
      width: size, 
      height: size, 
      display: 'inline-flex',  // Explicit display style for Safari
      alignItems: 'center',    // Explicit alignment for Safari
      justifyContent: 'center', // Explicit justification for Safari
      position: 'relative',    // Explicit position for Safari
      ...props.style 
    }}
    onClick={props.onClick}
    aria-hidden={props["aria-hidden"] ?? true}
  >
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  </div>
)

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed: boolean
  onCollapse: () => void
}

const navigationItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
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
    title: "Content",
    href: "/content",
    icon: FileText,
  },
  {
    title: "Experiments",
    href: "/experiments", 
    icon: FlaskConical,
  },
  {
    title: "Tasks",
    href: "/requirements",
    icon: ClipboardList,
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
  {
    title: "AI Team",
    href: "/agents",
    icon: Cpu, // Changed from MessageSquare to Cpu for AI representation
  },
  {
    title: "Chats",
    href: "/chat",
    icon: MessageSquare,
  },
]

export function Sidebar({ 
  className, 
  isCollapsed, 
  onCollapse 
}: SidebarProps) {
  const pathname = usePathname()
  const { user, isLoading } = useAuth()

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
        isCollapsed ? "justify-center px-3" : "justify-start px-6"
      )}>
        <Image 
          src="/images/logo.png"
          alt="Market Fit Logo"
          width={32}
          height={32}
          className={cn(
            "transition-all duration-200 h-8 w-8 object-contain",
            isCollapsed ? "mr-0" : "mr-2"
          )}
          priority
        />
        <span className={cn(
          "text-[1.1rem] font-bold transition-all duration-200",
          isCollapsed ? "scale-0 w-0" : "scale-100 w-auto"
        )}>
          MARKET FIT
        </span>
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
        <div className="space-y-1 px-3 py-6">
          {navigationItems.map((item) => (
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

      {/* Bottom Section - Fixed */}
      <div className="flex-none border-t border-border">
        <ConfigurationSection className="px-3" isCollapsed={isCollapsed} />
        <div className={cn(
          "border-t border-border px-3 py-4",
          isCollapsed && "flex justify-center"
        )}>
          <MenuItem
            href="/profile"
            icon={User}
            title={user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuario'}
            subtitle={user?.email || ''}
            avatarUrl={user?.user_metadata?.avatar_url || user?.user_metadata?.picture}
            isActive={pathname.startsWith('/profile')}
            isCollapsed={isCollapsed}
            className="![padding-top:28px] ![padding-bottom:28px]"
          >
            {!isCollapsed && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </MenuItem>
        </div>
      </div>
    </div>
  )
} 