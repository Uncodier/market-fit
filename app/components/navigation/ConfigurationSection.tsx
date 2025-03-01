"use client"

import { cn } from "@/lib/utils"
import { Settings, Bell, Shield, HelpCircle, LogOut } from "@/app/components/ui/icons"
import { MenuItem } from "./MenuItem"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

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
  
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)
      toast.loading("Signing out...")
      
      // 1. Limpiar cookies del navegador relacionadas con Supabase
      SUPABASE_COOKIES.forEach(name => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/;`
      })
      
      // 2. Limpiar localStorage
      try {
        // Intentar limpiar claves específicas primero
        LOCAL_STORAGE_KEYS.forEach(key => {
          localStorage.removeItem(key)
        })
        
        // Buscar cualquier clave que contenga 'supabase' o 'sb-'
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && (key.includes('supabase') || key.includes('sb-'))) {
            localStorage.removeItem(key)
          }
        }
      } catch (e) {
        console.error("Error clearing localStorage:", e)
      }
      
      // 3. Limpiar sessionStorage
      try {
        // Intentar limpiar claves específicas primero
        LOCAL_STORAGE_KEYS.forEach(key => {
          sessionStorage.removeItem(key)
        })
        
        // Buscar cualquier clave que contenga 'supabase' o 'sb-'
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i)
          if (key && (key.includes('supabase') || key.includes('sb-'))) {
            sessionStorage.removeItem(key)
          }
        }
      } catch (e) {
        console.error("Error clearing sessionStorage:", e)
      }
      
      // 4. Intentar cerrar sesión en Supabase directamente
      const supabase = createClient()
      await supabase.auth.signOut()
      
      // 5. Añadir un timestamp para evitar el caché
      const timestamp = new Date().getTime()
      
      // 6. Enfoque nuclear: limpiar todo el localStorage y sessionStorage
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch (e) {
        console.error("Error clearing all storage:", e)
      }
      
      // 7. Redirigir a la ruta de logout con parámetros para evitar caché
      window.location.href = `/api/auth/logout?t=${timestamp}&clear=full`
    } catch (error) {
      console.error("Error logging out:", error)
      toast.error("Error signing out")
      
      // En caso de error, intentar el enfoque nuclear
      try {
        localStorage.clear()
        sessionStorage.clear()
        
        // Limpiar todas las cookies
        document.cookie.split(';').forEach(cookie => {
          document.cookie = cookie.replace(/^ +/, '').replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
        });
      } catch (e) {
        console.error("Error in nuclear approach:", e)
      }
      
      // Redirigir directamente
      window.location.href = '/api/auth/logout?emergency=true'
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
      
      <div 
        onClick={handleLogout} 
        className={cn(
          "cursor-pointer", 
          isLoggingOut && "opacity-50 pointer-events-none"
        )}
      >
        <MenuItem
          href="#"
          icon={LogOut}
          title={isLoggingOut ? "Signing out..." : "Log out"}
          isActive={false}
          isCollapsed={isCollapsed}
        />
      </div>
    </div>
  )
} 