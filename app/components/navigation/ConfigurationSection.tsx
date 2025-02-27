"use client"

import { cn } from "@/lib/utils"
import { Settings, Bell, Shield, HelpCircle, LogOut } from "@/app/components/ui/icons"
import { MenuItem } from "./MenuItem"
import { usePathname, useRouter } from "next/navigation"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import Cookies from 'js-cookie'

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
  const router = useRouter()
  
  // Implementación directa de logout que no depende de la API
  const handleLogout = async () => {
    try {
      console.log('Cerrando sesión')
      
      // Siempre eliminar la cookie primero para asegurar logout local
      Cookies.remove('auth0_token')
      
      try {
        // Intentar redirigir a través de la API de Auth0
        window.location.href = '/api/auth/logout'
      } catch (error) {
        console.error("Error al redirigir a API:", error)
        // Fallback: redirigir directamente 
        router.push('/auth/login')
        router.refresh()
      }
    } catch (error) {
      console.error("Error en logout:", error)
      
      // Último recurso
      router.push('/auth/login')
      router.refresh()
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