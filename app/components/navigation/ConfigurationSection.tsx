"use client"

import { cn } from "@/lib/utils"
import { Settings, Bell, Shield, HelpCircle } from "lucide-react"
import { MenuItem } from "./MenuItem"
import { usePathname } from "next/navigation"

interface ConfigurationSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed?: boolean
}

const configItems = [
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
  {
    title: "Notifications",
    href: "/notifications",
    icon: Bell,
  },
  {
    title: "Security",
    href: "/security",
    icon: Shield,
  },
  {
    title: "Help",
    href: "/help",
    icon: HelpCircle,
  },
]

export function ConfigurationSection({ className, isCollapsed }: ConfigurationSectionProps) {
  const pathname = usePathname()

  return (
    <div className={cn("space-y-1 py-4", className)}>
      {configItems.map((item) => (
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
  )
} 