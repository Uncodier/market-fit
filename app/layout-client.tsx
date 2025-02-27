"use client"

import { Sidebar } from "./components/navigation/Sidebar"
import { TopBar } from "./components/navigation/TopBar"
import { usePathname } from "next/navigation"
import { TooltipProvider } from "./components/ui/tooltip"
import { useState, useEffect } from "react"
import { SiteProvider } from "./context/SiteContext"
import { cn } from "@/lib/utils"
import { AuthProvider } from './components/auth/auth-provider'

const navigationTitles: Record<string, { title: string, helpText?: string }> = {
  "/segments": {
    title: "Segments",
    helpText: "Create and manage user segments based on behavior and attributes"
  },
  "/experiments": {
    title: "Experiments",
    helpText: "Design and run A/B tests and experiments"
  },
  "/requirements": {
    title: "Requirements",
    helpText: "Track and manage product requirements and features"
  },
  "/assets": {
    title: "Assets",
    helpText: "Manage and organize your media files and documents"
  },
  "/leads": {
    title: "Leads",
    helpText: "Manage and track potential customers"
  },
  "/agents": {
    title: "Agents",
    helpText: "Configure and manage AI agents for your product"
  },
  "/profile": {
    title: "Profile",
    helpText: "Manage your account settings and preferences"
  },
  "/settings": {
    title: "Settings",
    helpText: "Configure your site settings and preferences"
  }
}

export default function LayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const currentPage = navigationTitles[pathname] || { title: "Dashboard" }
  
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarCollapsed')
      return saved ? JSON.parse(saved) : false
    }
    return false
  })

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed))
  }, [isCollapsed])

  const handleCollapse = () => {
    setIsCollapsed((prev: boolean) => !prev)
  }

  // Determinar si estamos en la página de login
  const isLoginPage = pathname === '/auth/login'

  return (
    <AuthProvider>
      <SiteProvider>
        <TooltipProvider>
          {isLoginPage ? (
            // Para la página de login, solo mostrar el contenido sin layout
            <div className="min-h-screen w-full">
              {children}
            </div>
          ) : (
            // Para el resto de páginas, mostrar el layout completo
            <div className="flex h-screen overflow-hidden">
              <Sidebar 
                isCollapsed={isCollapsed} 
                onCollapse={handleCollapse} 
                className="flex-none fixed left-0 top-0 h-screen z-20"
              />
              <div 
                className={cn(
                  "flex-1 flex flex-col transition-all duration-200 bg-[rgb(0_0_0_/0.02)]",
                  isCollapsed ? "ml-16" : "ml-64"
                )}
              >
                <TopBar 
                  title={currentPage.title}
                  helpText={currentPage.helpText}
                  isCollapsed={isCollapsed}
                  onCollapse={handleCollapse}
                  className="fixed top-0 right-0 z-10 bg-[rgb(0_0_0_/0.02)]"
                  style={{ 
                    left: isCollapsed ? '4rem' : '16rem'
                  }}
                />
                <div className="h-16 flex-none"></div>
                <main className="flex-1 overflow-auto p-0">
                  {children}
                </main>
              </div>
            </div>
          )}
        </TooltipProvider>
      </SiteProvider>
    </AuthProvider>
  )
} 