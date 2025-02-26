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
  Home
} from "lucide-react"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { ConfigurationSection } from "./ConfigurationSection"
import { MenuItem } from "./MenuItem"
import { SiteSelector } from "./SiteSelector"
import Link from "next/link"

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
      <Link href="/dashboard" className="flex items-center justify-center h-16 px-3 border-b flex-none">
        <span className={cn(
          "text-xl font-bold transition-all duration-200",
          isCollapsed ? "scale-0 w-0" : "scale-100 w-auto"
        )}>
          MARKET FIT
        </span>
        <span className={cn(
          "text-xl font-bold absolute transition-all duration-200",
          isCollapsed ? "scale-100" : "scale-0 w-0"
        )}>
          MF
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
        <div className="border-t px-3 py-2">
          <MenuItem
            href="/profile"
            icon={User}
            title="Alex Stanton"
            subtitle="alex@marketfit.com"
            avatarUrl="/avatars/alex.jpg"
            isActive={pathname === '/profile'}
            isCollapsed={isCollapsed}
          >
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </MenuItem>
        </div>
      </div>
    </div>
  )
} 