"use client"

import { Sidebar } from "./components/navigation/Sidebar"
import { TopBar } from "./components/navigation/TopBar"
import { MobileWorkspaceNavigation } from "./components/navigation/MobileWorkspaceNavigation"
import { usePathname, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { WorkspaceStartupBoundary, WorkspaceStartupContent } from './workspace-preview/WorkspaceStartupBoundary'
import { useLayout } from "./context/LayoutContext"
import { NotificationsProvider } from "./notifications/context/NotificationsContext"
import { usePageRefreshPrevention } from "./hooks/use-prevent-refresh"
import { useWakeSessionRefresh } from "./hooks/use-wake-session-refresh"
import { useNavigationFeedback } from "./hooks/use-navigation-feedback"
import { useArtifactRouterPatch } from "./hooks/use-artifact-router-patch"
import { useMobileViewport } from "./hooks/use-mobile-view"
import { useLocalization } from "./context/LocalizationContext"
import { ScreenAccessRedirect } from "./components/navigation/ScreenAccessRedirect"
import { GuidedTour } from "./components/onboarding/GuidedTour"

const pathToNavKey: Record<string, string> = {
  "/dashboard": "dashboard",
  "/control-center": "controlCenter",
    "/pos/check-in": "checkIn",
    "/pos": "pos",
    "/catalog": "catalog",
    "/price-lists": "priceLists",
    "/inventory": "inventory",
    "/orders": "orders",
    "/shipments": "shipments",
  "/reservations": "reservations",
  "/accounting/entries": "journalEntries",
  "/accounting": "chartOfAccounts",
  "/finance": "financeReports",
  "/chat": "chat",

  "/promotions": "promotions",
  "/segments": "segments",
  "/people": "people",
  "/content": "content",
  "/experiments": "experiments",
  "/requirements": "requirements",
  "/assets": "assets",
  "/notifications": "notifications",
  "/leads": "leads",
  "/sales": "sales",
  "/billing": "billing",
  "/robots": "robots",
  "/agents": "agents",
  "/profile": "profile",
  "/settings": "settings",
  "/skills": "skills",
  "/connectors": "connectors",
  "/create-site": "createSite",
  "/projects": "projects",
  "/context": "context",
  "/costs": "costs",
  "/onboarding": "onboarding",
}

function getNavigationTitle(pathname: string, t: (key: string) => string): { title: string, helpText?: string, helpWelcomeMessage?: string, helpTask?: string } {
  // Find matching key (support exact paths and subpaths like /catalog/[id])
  let key = pathToNavKey[pathname];
  if (!key) {
    const matchingPrefix = Object.keys(pathToNavKey).find(path => pathname.startsWith(path + '/'));
    if (matchingPrefix) key = pathToNavKey[matchingPrefix];
  }
  
  if (!key) return { title: t('layout.topbar.dashboard') || 'Dashboard' }
  const title = t(`layout.nav.${key}.title`) || key.charAt(0).toUpperCase() + key.slice(1)
  const helpText = t(`layout.nav.${key}.help`)
  const helpWelcomeMessage = key === 'dashboard' ? (t('layout.nav.dashboard.helpWelcome') || undefined) : undefined
  const helpTask = key === 'dashboard' ? (t('layout.nav.dashboard.helpTask') || undefined) : undefined
  return { title, helpText: helpText || undefined, helpWelcomeMessage, helpTask }
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
    
    // Verificar currentSiteId
    const rawSiteId = localStorage.getItem("currentSiteId")
    
    if (rawSiteId) {
      // Intentar diferentes métodos de limpieza
      let cleanedId
      
      // 1. Intentar parsear como JSON
      try {
        const parsed = JSON.parse(rawSiteId)
        if (typeof parsed === 'string') {
          cleanedId = parsed.replace(/["']/g, '')
        }
      } catch {
        // 2. Intentar limpiar directamente
        cleanedId = rawSiteId.replace(/["']/g, '')
      }
      
      // 3. Verificar formato básico de UUID
      if (cleanedId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanedId)) {
        // Si el valor limpio es diferente del original y es un UUID válido, actualizarlo
        if (cleanedId !== rawSiteId) {
          localStorage.setItem("currentSiteId", cleanedId)
        }
      } 
      // 4. Caso especial para "default"
      else if (cleanedId === "default") {
        if (cleanedId !== rawSiteId) {
          localStorage.setItem("currentSiteId", "default")
        }
      }
      // 5. Si es un valor completamente inválido, eliminarlo
      else {
        console.warn("UUID inválido encontrado, limpiando localStorage...")
        localStorage.removeItem("currentSiteId")
      }
    }
    
  } catch (error) {
    console.error("Error durante la limpieza de localStorage:", error)
  }
}

// Componente interno que usa el contexto
function LayoutClientInner({
  children,
  pathname,
  breadcrumbFromEvent,
  customTitle,
}: {
  children: React.ReactNode
  pathname: string
  breadcrumbFromEvent: React.ReactNode
  customTitle: string | null
}) {
  const searchParams = useSearchParams()
  const isArtifact = searchParams.get("artifact") === "true"
  
  const { t } = useLocalization()
  const { isLayoutCollapsed, setIsLayoutCollapsed, robotsViewMode } = useLayout()
  const isMobile = useMobileViewport()
  const [isCreateSaleOpen, setIsCreateSaleOpen] = useState(false)

  const handleCollapse = () => {
    setIsLayoutCollapsed(!isLayoutCollapsed)
  }

  // Clean up body pointer-events on navigation.
  useEffect(() => {
    // Sometimes Radix UI components (Dialogs, Dropdowns) leave pointer-events: none 
    // on body when navigating before they fully close, causing clicks to be ignored
    document.body.style.pointerEvents = '';
    document.documentElement.style.pointerEvents = '';
    
  }, [pathname])

  useWakeSessionRefresh()
  useNavigationFeedback()
  useArtifactRouterPatch()

  // Pages that need full-height layout (no scroll, fixed height container)
  const isChatPage = pathname && pathname.startsWith('/chat');
  const isRobotsPage = pathname && pathname.startsWith('/robots');
  const isAppPage = isChatPage || isRobotsPage;

  let pageCustomTitle: string | null = null;
  let customHelpText: string | null = null;
  let customBreadcrumb: React.ReactNode = null;
  
  if (pathname && pathname.startsWith('/chat')) {
    pageCustomTitle = t('layout.topbar.chat') || "Chat";
    customHelpText = t('layout.topbar.chatHelp') || "Chatting with your agent";
    
    if (breadcrumbFromEvent) {
      customBreadcrumb = breadcrumbFromEvent;
    } else {
      const childrenAsAny = children as any;
      if (childrenAsAny && childrenAsAny.type && childrenAsAny.type.breadcrumb) {
        customBreadcrumb = childrenAsAny.type.breadcrumb;
      }
    }
  }
  
  const currentPage = pageCustomTitle || customTitle
    ? { title: pageCustomTitle || customTitle, helpText: customHelpText, helpWelcomeMessage: undefined, helpTask: undefined }
    : getNavigationTitle(pathname, t);

  // Determinar si estamos en la página de login
  const isLoginPage = pathname === '/auth/login'

  // Handle create sale button click
  const handleCreateSaleClick = () => {
    window.dispatchEvent(new CustomEvent('sales:create'))
  }

  // Handle create deal button click
  const handleCreateDealClick = () => {
    window.dispatchEvent(new CustomEvent('deals:create'))
  }

  if (isArtifact) {
    return (
      <div className="flex min-h-[100dvh] w-full bg-background">
        <div className="flex-1 flex flex-col min-w-0 transition-[padding] duration-300 ease-in-out">
          <main 
            className={cn(
              "flex-1 min-w-0 relative",
              (isChatPage) ? "flex flex-col overflow-hidden" : (isRobotsPage ? "flex flex-col overflow-visible" : "overflow-visible")
            )} 
            style={{
              ...(isAppPage ? { height: '100dvh' } : {}),
              '--topbar-height': '0px'
            } as React.CSSProperties}
          >
            {children}
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "flex min-h-[100dvh] w-full bg-background",
      isLayoutCollapsed ? "collapsed" : ""
    )}>
        {isLoginPage || pathname.startsWith("/navigation") ? (
          // Para la página de login o rutas sin layout, mostrar el contenido con el Tour si aplica
          <div className="min-h-[100dvh] w-full relative">
            {!isLoginPage && <GuidedTour />}
            {children}
          </div>
        ) : (
          // Para el resto de páginas, mostrar el layout completo
          <div className="flex overflow-visible relative min-h-[100dvh] w-full">
            <Sidebar 
              desktopVisible={isMobile === false}
              isCollapsed={isLayoutCollapsed} 
              onCollapse={handleCollapse}
              className="!hidden md:!flex flex-none fixed left-0 top-0 z-[210]"
            />
            {/* TOUR EXPLICITAMENTE RENDERIZADO */}
            <GuidedTour />
            <ScreenAccessRedirect />
            <WorkspaceStartupBoundary pathname={pathname} search={searchParams.toString()}>
            <div
              className="flex-1 flex flex-col min-w-0 transition-[padding] duration-300 ease-in-out"
              style={{ paddingLeft: isMobile ? 0 : isLayoutCollapsed ? 64 : 256 }}
            >
              <TopBar 
                title={currentPage.title || ""}
                helpText={currentPage.helpText || undefined}
                helpWelcomeMessage={currentPage.helpWelcomeMessage || undefined}
                helpTask={currentPage.helpTask || undefined}
                isCollapsed={isLayoutCollapsed}
                onCollapse={handleCollapse}
                className="fixed top-0 right-0 left-0"
                style={{ paddingLeft: isMobile ? 0 : isLayoutCollapsed ? 64 : 256 }}
                breadcrumb={customBreadcrumb}
                onCreateSale={pathname === "/sales" ? handleCreateSaleClick : undefined}
                onCreateDeal={pathname === "/deals" ? handleCreateDealClick : undefined}
                viewMode={robotsViewMode}
              />
              {!isRobotsPage && (
                <div className={!isChatPage && customBreadcrumb ? "h-[64px] md:h-[calc(64px+41px)] flex-none" : "h-[64px] flex-none"}></div>
              )}
              <main 
                className={cn(
                  "flex-1 min-w-0",
                  (isChatPage) ? "flex flex-col overflow-hidden" : (isRobotsPage ? "flex flex-col overflow-hidden" : "overflow-visible")
                )} 
                style={{
                  ...(isAppPage ? { height: isRobotsPage ? '100dvh' : 'calc(100dvh - 64px)' } : {}),
                  '--topbar-height': '64px'
                } as React.CSSProperties}
              >
                <WorkspaceStartupContent>{children}</WorkspaceStartupContent>
              </main>
            </div>
            </WorkspaceStartupBoundary>
          </div>
        )}
        {!isLoginPage && isMobile === true && <MobileWorkspaceNavigation />}
      </div>
  )
}

export default function LayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [isMounted, setIsMounted] = useState(false)
  const [breadcrumbFromEvent, setBreadcrumbFromEvent] = useState<React.ReactNode>(null)
  const [customTitle, setCustomTitle] = useState<string | null>(null)

  // Use the page refresh prevention hook
  usePageRefreshPrevention()

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

  // Mostrar la página con posible indicador de error
  // NOTE: ThemeProvider, SiteProvider, and LayoutProvider are NOT wrapped here.
  // They already exist in Providers.tsx (app/providers/Providers.tsx) which wraps
  // the entire app. Duplicating them here created two independent React context
  // instances -- RobotsProvider (in Providers.tsx) read from the OUTER SiteProvider
  // while page components read from the INNER one, causing state desync.
  return (
    <NotificationsProvider active={pathname === '/notifications'}>
      <LayoutClientInner
        pathname={pathname}
        breadcrumbFromEvent={breadcrumbFromEvent}
        customTitle={customTitle}
      >
        {children}
      </LayoutClientInner>
    </NotificationsProvider>
  )
} 