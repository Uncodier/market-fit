"use client"

import { cn } from "@/lib/utils"
import { Settings, Bell, Shield, HelpCircle, LogOut, Sun, Moon } from "@/app/components/ui/icons"
import { MenuItem } from "./MenuItem"
import { usePathname } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Switch } from "@/app/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip"
import { useTheme } from "@/app/context/ThemeContext"

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
  const [isChanging, setIsChanging] = useState(false)
  // Create a dummy element ref that we'll use for focus management
  const dummyFocusRef = useRef<HTMLDivElement>(null);
  
  // Use theme context instead of local state
  const { isDarkMode, setTheme } = useTheme()
  
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
  
  const toggleTheme = () => {
    // Force immediate loss of focus
    setTimeout(() => removeFocus(), 50);
    
    setIsChanging(true);
    setTheme(isDarkMode ? "light" : "dark");
    
    // Simulate a small delay for animation
    setTimeout(() => {
      setIsChanging(false);
      // Remove focus again after animation
      setTimeout(() => removeFocus(), 50);
    }, 300);
  };
  
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
    <div className={cn("space-y-1 py-4", className)} onMouseDown={(e) => e.preventDefault()}>
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
      
      {/* Separator between logout and theme toggle */}
      <div className="h-px bg-border/30 mx-3 my-3.5" />
      
      {/* Theme Toggle */}
      {isCollapsed ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="mx-auto flex justify-center items-center h-[39px] w-[39px] cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                onClick={(e) => {
                  toggleTheme();
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                role="button"
                tabIndex={-1}
                aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    toggleTheme();
                  }
                }}
                style={{ outline: 'none' }}
              >
                <div className={cn(
                  "transition-all duration-300 flex items-center justify-center",
                  isChanging ? "scale-75 opacity-0" : "scale-100 opacity-100"
                )}>
                  {isDarkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{isDarkMode ? "Switch to light mode" : "Switch to dark mode"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <div 
          className={cn(
            "flex items-center justify-between p-3 mx-2 rounded-lg transition-all duration-200",
            "bg-background/80 hover:bg-accent/10",
            "border border-transparent hover:border-border/30"
          )}
          style={{ outline: 'none' }}
        >
          <div 
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => toggleTheme()}
            onMouseDown={(e) => e.preventDefault()}
            role="button"
            tabIndex={-1}
            style={{ outline: 'none' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                toggleTheme();
              }
            }}
          >
            <div className={cn(
              "flex justify-center items-center h-8 w-8 rounded-md bg-muted transition-all duration-300",
              isDarkMode ? "bg-muted/80" : "bg-muted/50",
              isChanging ? "rotate-180 scale-90" : "rotate-0 scale-100"
            )}>
              {isDarkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </div>
            <span className="text-sm font-medium">{isDarkMode ? "Dark Mode" : "Light Mode"}</span>
          </div>
          {/* Switch wrapper with minimal interference */}
          <Switch
            checked={isDarkMode}
            onCheckedChange={() => toggleTheme()}
            aria-label={isDarkMode ? "Disable dark mode" : "Enable dark mode"}
            className="data-[state=checked]:bg-primary/90 focus:outline-none focus:ring-0"
            style={{ outline: 'none' }}
          />
        </div>
      )}
      
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