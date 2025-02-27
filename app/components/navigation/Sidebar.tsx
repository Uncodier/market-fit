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
  FolderOpen
} from "@/app/components/ui/icons"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { ConfigurationSection } from "./ConfigurationSection"
import { MenuItem } from "./MenuItem"
import { SiteSelector } from "./SiteSelector"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/app/hooks/use-auth"

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
    title: "Segments",
    href: "/segments",
    icon: LayoutGrid,
  },
  {
    title: "Experiments",
    href: "/experiments", 
    icon: FlaskConical,
  },
  {
    title: "Requirements",
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
    title: "Agents",
    href: "/agents",
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
        "bg-white text-gray-900 transition-all duration-200 border-r z-40",
        className
      )}
    >
      {/* Logo Section - Fixed */}
      <Link href="/dashboard" className={cn(
        "flex items-center h-16 border-b flex-none",
        isCollapsed ? "justify-center px-3" : "justify-start px-6"
      )}>
        <Image 
          src="https://cloudfront.cdn.uncodie.com/zoDKXCi32aQHAee0dGmkjv/d8dcc649fecfe6d7d3c71901442818767d410b1d.png"
          alt="Market Fit Logo"
          width={32}
          height={32}
          className={cn(
            "transition-all duration-200",
            isCollapsed ? "mr-0" : "mr-2"
          )}
          style={{ height: 'auto', maxHeight: '25px' }}
        />
        <span className={cn(
          "text-[1.1rem] font-bold transition-all duration-200",
          isCollapsed ? "scale-0 w-0" : "scale-100 w-auto"
        )}>
          MARKET FIT
        </span>
      </Link>

      {/* Site Selector */}
      <div className="px-3 py-2 border-b">
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
              isActive={pathname === item.href}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>
      </div>

      {/* Bottom Section - Fixed */}
      <div className="flex-none border-t bg-white">
        <ConfigurationSection className="px-3" isCollapsed={isCollapsed} />
        <div className={cn(
          "border-t px-3 py-4",
          isCollapsed && "flex justify-center"
        )}>
          <MenuItem
            href="/profile"
            icon={User}
            title={user?.name || user?.email?.split('@')[0] || 'Usuario'}
            subtitle={user?.email || ''}
            avatarUrl={user?.picture}
            isActive={pathname === '/profile'}
            isCollapsed={isCollapsed}
            className="![padding-top:28px] ![padding-bottom:28px]"
          >
            {!isCollapsed && <ChevronRight className="h-4 w-4 text-gray-400" />}
          </MenuItem>
        </div>
      </div>
    </div>
  )
} 