"use client"

import { cn } from "@/lib/utils"
import { Settings, Bell, Shield, HelpCircle, LogOut } from "@/app/components/ui/icons"
import { MenuItem } from "./MenuItem"
import { usePathname } from "next/navigation"
import { useAuthContext } from "@/app/components/auth/auth-provider"

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
  const { signOut } = useAuthContext()
  
  const handleLogout = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error("Error al cerrar sesión:", error)
    }
  }

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
      
      <div onClick={handleLogout} className="cursor-pointer">
        <MenuItem
          href="#"
          icon={LogOut}
          title="Log out"
          isActive={false}
          isCollapsed={isCollapsed}
        />
      </div>
    </div>
  )
} 