"use client"

import { Sidebar } from "./components/navigation/Sidebar"
import { TopBar } from "./components/navigation/TopBar"
import { usePathname } from "next/navigation"
import { TooltipProvider } from "./components/ui/tooltip"
import { useState, useEffect } from "react"
import { SiteProvider } from "./context/SiteContext"
import { cn } from "@/lib/utils"
import { Toaster } from "./components/ui/sonner"
import { createClient } from "@/lib/supabase/client"
import { type Segment } from "./requirements/types"
import { ThemeProvider } from "./context/ThemeContext"
import { LayoutProvider, useLayout } from "./context/LayoutContext"
import { NotificationsProvider } from "./notifications/context/NotificationsContext"

const navigationTitles: Record<string, { title: string, helpText?: string }> = {
  "/control-center": {
    title: "Control Center",
    helpText: "Manage and track all your tasks across different categories and types"
  },
  "/segments": {
    title: "Segments",
    helpText: "Create and manage user segments based on behavior and attributes"
  },
  "/content": {
    title: "Content",
    helpText: "Create and manage content for different segments and channels"
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
  "/notifications": {
    title: "Notifications",
    helpText: "Stay updated with all the activity in your account"
  },
  "/leads": {
    title: "Leads",
    helpText: "Manage and track potential customers"
  },
  "/sales": {
    title: "Sales",
    helpText: "Manage and track your sales and orders"
  },
  "/billing": {
    title: "Billing",
    helpText: "Manage your subscription plans and payment methods"
  },
  "/agents": {
    title: "AI Team",
    helpText: "Configure and manage AI team for your product"
  },
  "/profile": {
    title: "Profile",
    helpText: "Manage your account settings and preferences"
  },
  "/settings": {
    title: "Settings",
    helpText: "Configure your site settings and preferences"
  },
  "/site/create": {
    title: "Create New Site",
    helpText: "Set up a new site with your preferences and configuration"
  }
}

/**
 * Limpia un UUID de comillas extras o caracteres no válidos
 * @param id Posible UUID con formato incorrecto
 * @returns UUID limpio o null si no es válido
 */
function cleanUUID(id: string | null): string | null {
  if (!id) return null
  
  // Eliminar comillas extras si existen
  let cleaned = id.replace(/["']/g, '')
  
  // Verificar el formato básico de UUID después de limpiar
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleaned)) {
    return cleaned
  }
  
  // Caso especial para "default" u otros valores especiales
  if (cleaned === "default") return cleaned
  
  console.warn("UUID inválido después de limpieza:", id, "->", cleaned)
  return null
}

/**
 * Función segura para limpiar valores en localStorage
 * Se ejecuta al inicio para corregir posibles formatos incorrectos
 */
function cleanLocalStorageOnStartup() {
  if (typeof window === 'undefined') return
  
  try {
    console.log("Verificando integridad de localStorage...")
    
    // Verificar currentSiteId
    const rawSiteId = localStorage.getItem("currentSiteId")
    console.log("ID del sitio encontrado (raw):", rawSiteId)
    
    if (rawSiteId) {
      // Intentar diferentes métodos de limpieza
      let cleanedId
      
      // 1. Intentar parsear como JSON
      try {
        const parsed = JSON.parse(rawSiteId)
        if (typeof parsed === 'string') {
          cleanedId = parsed.replace(/["']/g, '')
          console.log("UUID limpiado mediante parsing JSON:", cleanedId)
        }
      } catch {
        // 2. Intentar limpiar directamente
        cleanedId = rawSiteId.replace(/["']/g, '')
        console.log("UUID limpiado directamente:", cleanedId)
      }
      
      // 3. Verificar formato básico de UUID
      if (cleanedId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanedId)) {
        // Si el valor limpio es diferente del original y es un UUID válido, actualizarlo
        if (cleanedId !== rawSiteId) {
          console.log("Corrigiendo UUID en localStorage:", cleanedId)
          localStorage.setItem("currentSiteId", cleanedId)
        }
      } 
      // 4. Caso especial para "default"
      else if (cleanedId === "default") {
        if (cleanedId !== rawSiteId) {
          console.log("Corrigiendo valor 'default' en localStorage")
          localStorage.setItem("currentSiteId", "default")
        }
      }
      // 5. Si es un valor completamente inválido, eliminarlo
      else {
        console.warn("UUID inválido encontrado, limpiando localStorage...")
        localStorage.removeItem("currentSiteId")
      }
    }
    
    console.log("Verificación de localStorage completada")
  } catch (error) {
    console.error("Error durante la limpieza de localStorage:", error)
  }
}

export default function LayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [isMounted, setIsMounted] = useState(false)
  const [segments, setSegments] = useState<Segment[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [breadcrumbFromEvent, setBreadcrumbFromEvent] = useState<React.ReactNode>(null)
  const [customTitle, setCustomTitle] = useState<string | null>(null)
  const { isLayoutCollapsed, setIsLayoutCollapsed } = useLayout()
  const [isCreateSaleOpen, setIsCreateSaleOpen] = useState(false)

  // Determine if we're on an experiment detail page
  const isExperimentDetailPage = pathname ? /^\/experiments\/[a-zA-Z0-9-]+$/.test(pathname) : false;

  // Inicialización crítica (ejecutar inmediatamente)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Operaciones no críticas (deferir)
  useEffect(() => {
    if (!isMounted) return

    // Limpiar localStorage después de la carga inicial
    const cleanupTimer = setTimeout(() => {
      cleanLocalStorageOnStartup()
    }, 1000)

    // Manejar eventos de breadcrumb
    const handleBreadcrumbUpdate = (event: any) => {
      if (event.detail) {
        // If title is provided, update the customTitle state
        if (event.detail.title !== undefined) {
          setCustomTitle(event.detail.title);
        }
        
        // Original behavior for backward compatibility
        if (event.detail?.breadcrumb) {
          setBreadcrumbFromEvent(event.detail.breadcrumb)
        }
      }
    }
    
    window.addEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener)
    
    return () => {
      clearTimeout(cleanupTimer)
      window.removeEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener)
    }
  }, [isMounted])

  // Cargar segmentos solo cuando sea necesario
  useEffect(() => {
    if (!isMounted || !['/experiments', '/requirements'].includes(pathname)) {
      setSegments([])
      return
    }

    const fetchTimer = setTimeout(async () => {
      try {
        const supabase = createClient()
        const { data: segmentsData, error } = await supabase
          .from('segments')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        setSegments(segmentsData || [])
      } catch (error) {
        console.error('Error fetching segments:', error)
        setFetchError('Error loading segments')
        setRetryCount(prev => prev + 1)
      }
    }, 500)

    return () => clearTimeout(fetchTimer)
  }, [isMounted, pathname])

  // Si la ruta actual comienza con /chat, extraer el breadcrumb de los props de los hijos
  let pageCustomTitle: string | null = null;
  let customHelpText: string | null = null;
  let customBreadcrumb: React.ReactNode = null;
  const isChatPage = pathname && pathname.startsWith('/chat');
  
  if (isChatPage) {
    pageCustomTitle = "Chat";
    customHelpText = "Chatting with your agent";
    
    // Usar el breadcrumb del evento si está disponible
    if (breadcrumbFromEvent) {
      customBreadcrumb = breadcrumbFromEvent;
    } else {
      // Mantener la lógica anterior como fallback
      const childrenAsAny = children as any;
      if (childrenAsAny && childrenAsAny.type && childrenAsAny.type.breadcrumb) {
        customBreadcrumb = childrenAsAny.type.breadcrumb;
      }
    }
  }
  
  const currentPage = pageCustomTitle || customTitle
    ? { title: pageCustomTitle || customTitle, helpText: customHelpText }
    : (navigationTitles[pathname] || { title: "Dashboard" });

  const handleCollapse = () => {
    setIsLayoutCollapsed(!isLayoutCollapsed)
  }

  // Determinar si estamos en la página de login
  const isLoginPage = pathname === '/auth/login'

  // Handle create sale button click
  const handleCreateSaleClick = () => {
    window.dispatchEvent(new CustomEvent('sales:create'))
  }

  // Renderizar un estado de carga simple hasta que la aplicación esté hidratada
  if (!isMounted) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        {/* Placeholder mientras se carga el cliente */}
      </div>
    )
  }

  // Mostrar la página con posible indicador de error
  return (
    <>
      {fetchError && (
        <div className="fixed bottom-4 right-4 bg-destructive text-destructive-foreground p-4 rounded-md shadow-lg z-50">
          Error: {fetchError}
        </div>
      )}
      {isLoginPage ? (
        // Para la página de login, solo mostrar el contenido sin layout
        <div className="min-h-screen w-full">
          {children}
        </div>
      ) : (
        // Para el resto de páginas, mostrar el layout completo
        <NotificationsProvider>
          <div className="flex h-fit overflow-visible relative min-h-screen">
            <Sidebar 
              isCollapsed={isLayoutCollapsed} 
              onCollapse={handleCollapse} 
              className="flex-none fixed left-0 top-0 h-screen z-20"
            />
            <div 
              className={cn(
                "flex-1 flex flex-col transition-all duration-200 bg-[rgb(0_0_0_/0.02)]",
                isLayoutCollapsed ? "ml-16" : "ml-64"
              )}
            >
              <TopBar 
                title={currentPage.title || ""}
                helpText={currentPage.helpText || undefined}
                isCollapsed={isLayoutCollapsed}
                onCollapse={handleCollapse}
                segments={segments}
                className="fixed top-0 right-0 z-10"
                style={{ 
                  left: isLayoutCollapsed ? '4rem' : '16rem',
                }}
                breadcrumb={customBreadcrumb}
                isExperimentDetailPage={isExperimentDetailPage}
                onCreateSale={pathname === "/sales" ? handleCreateSaleClick : undefined}
              />
              <div className={customBreadcrumb ? "h-[calc(64px+41px)] flex-none" : "h-[64px] flex-none"}></div>
              <main 
                className={cn(
                  "flex-1",
                  isChatPage ? "flex flex-col overflow-hidden" : "overflow-visible"
                )} 
                style={
                  isChatPage ? 
                  { height: customBreadcrumb ? 'calc(100vh - 105px)' : 'calc(100vh - 64px)' } as React.CSSProperties 
                  : {}
                }
              >
                {children}
              </main>
            </div>
          </div>
        </NotificationsProvider>
      )}
      <Toaster />
    </>
  )
} 