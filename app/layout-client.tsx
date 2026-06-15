"use client"

import { Sidebar } from "./components/navigation/Sidebar"
import { TopBar } from "./components/navigation/TopBar"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { Toaster } from "./components/ui/sonner"
import { createClient } from "@/lib/supabase/client"
import { type Segment } from "./requirements/types"
import { useLayout } from "./context/LayoutContext"
import { NotificationsProvider } from "./notifications/context/NotificationsContext"
import { usePageRefreshPrevention } from "./hooks/use-prevent-refresh"
import { useIsMobile } from "./hooks/use-mobile-view"
import { useLocalization } from "./context/LocalizationContext"

const pathToNavKey: Record<string, string> = {
  "/dashboard": "dashboard",
  "/control-center": "controlCenter",
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
  "/create-site": "createSite",
  "/projects": "projects",
  "/context": "context",
  "/costs": "costs",
  "/onboarding": "onboarding",
}

function getNavigationTitle(pathname: string, t: (key: string) => string): { title: string, helpText?: string, helpWelcomeMessage?: string, helpTask?: string } {
  const key = pathToNavKey[pathname]
  if (!key) return { title: t('layout.topbar.dashboard') || 'Dashboard' }
  const title = t(`layout.nav.${key}.title`) || pathname
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
  segments,
  breadcrumbFromEvent,
  customTitle,
  fetchError,
  isExperimentDetailPage,
}: {
  children: React.ReactNode
  pathname: string
  segments: Segment[]
  breadcrumbFromEvent: React.ReactNode
  customTitle: string | null
  fetchError: string | null
  isExperimentDetailPage: boolean
}) {
  const searchParams = useSearchParams()
  const isArtifact = searchParams.get("artifact") === "true"
  
  const { t } = useLocalization()
  const { isLayoutCollapsed, setIsLayoutCollapsed, robotsViewMode } = useLayout()
  const isMobile = useIsMobile()
  const [isCreateSaleOpen, setIsCreateSaleOpen] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  const handleCollapse = () => {
    setIsLayoutCollapsed(!isLayoutCollapsed)
  }

  // Close mobile sidebar when switching to desktop
  useEffect(() => {
    if (!isMobile && isMobileSidebarOpen) {
      setIsMobileSidebarOpen(false)
    }
  }, [isMobile])

  // Fix: Clean up body pointer-events and close mobile sidebar on navigation
  useEffect(() => {
    // Sometimes Radix UI components (Dialogs, Dropdowns) leave pointer-events: none 
    // on body when navigating before they fully close, causing clicks to be ignored
    document.body.style.pointerEvents = '';
    
    // Also ensure mobile sidebar closes on navigation
    setIsMobileSidebarOpen(false);
  }, [pathname])

  // Fix: Clean up stale UI state when returning from background and quietly
  // refresh the Supabase session after long idle. We intentionally do NOT
  // call `router.refresh()` here: in Next.js 16 / React 19 a pending RSC
  // transition (especially one that ends up redirected by middleware) can
  // deadlock the App Router, leaving subsequent `router.push()` calls
  // (e.g. sidebar clicks) silently queued forever. See:
  //   https://github.com/vercel/next.js/issues/86055
  //   https://github.com/vercel/next.js/issues/84299
  // Symptoms: after coming back to the tab, in-page interactions still
  // work but clicking any sidebar/menu item does nothing.
  const hiddenSinceRef = useRef<number | null>(null)
  const isRefreshingAfterIdleRef = useRef(false)
  const wakeHandledRef = useRef(false)
  const router = useRouter()

  // Fix: Intercept router methods and update DOM links to maintain artifact=true
  useEffect(() => {
    if (typeof window === 'undefined') return

    const currentParams = new URLSearchParams(window.location.search)
    const isArtifactInUrl = currentParams.get('artifact') === 'true'

    // 1. Patch router methods if artifact is true
    if (isArtifactInUrl && !(router as any)._patchedForArtifact) {
      const originalPush = router.push
      const originalReplace = router.replace
      const originalPrefetch = router.prefetch

      const appendArtifactIfNeeded = (href: string) => {
        if (typeof href !== 'string') return href
        const currentUrlParams = new URLSearchParams(window.location.search)
        if (currentUrlParams.get('artifact') === 'true') {
          if (href.startsWith('/') || href.startsWith('?') || href.startsWith('#')) {
            const [pathAndSearch, hash] = href.split('#')
            const [path, search] = pathAndSearch.split('?')
            const params = new URLSearchParams(search || '')
            if (!params.has('artifact')) {
              params.set('artifact', 'true')
              return `${path}?${params.toString()}${hash !== undefined ? `#${hash}` : ''}`
            }
          }
        }
        return href
      }

      router.push = (href: string, options?: any) => {
        return originalPush.call(router, appendArtifactIfNeeded(href), options)
      }

      router.replace = (href: string, options?: any) => {
        return originalReplace.call(router, appendArtifactIfNeeded(href), options)
      }

      if (originalPrefetch) {
        router.prefetch = (href: string, options?: any) => {
          return originalPrefetch.call(router, appendArtifactIfNeeded(href), options)
        }
      }

      (router as any)._patchedForArtifact = true
    }

    // 2. Keep DOM links updated for "Open in new tab" and hovering
    if (isArtifactInUrl) {
      const updateLinks = () => {
        document.querySelectorAll('a[href]').forEach(a => {
          const href = a.getAttribute('href')
          if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return
          if (href.startsWith('/') || href.startsWith('?') || href.startsWith('#')) {
            const [pathAndSearch, hash] = href.split('#')
            const [path, search] = pathAndSearch.split('?')
            const params = new URLSearchParams(search || '')
            if (!params.has('artifact')) {
              params.set('artifact', 'true')
              a.setAttribute('href', `${path}?${params.toString()}${hash !== undefined ? `#${hash}` : ''}`)
            }
          }
        })
      }

      updateLinks()

      const observer = new MutationObserver((mutations) => {
        let shouldUpdate = false
        for (const mutation of mutations) {
          if (mutation.addedNodes.length > 0) {
            shouldUpdate = true
            break
          }
          if (mutation.type === 'attributes' && mutation.attributeName === 'href') {
            const target = mutation.target as HTMLAnchorElement
            if (target.tagName === 'A' && target.getAttribute('href') && !target.getAttribute('href')?.includes('artifact=true')) {
               shouldUpdate = true
               break
            }
          }
        }
        if (shouldUpdate) {
          updateLinks()
        }
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href']
      })

      return () => observer.disconnect()
    }
  }, [router, pathname, searchParams])

  useEffect(() => {
    // Threshold after which we consider the session potentially stale.
    // Kept low on purpose: background tabs are aggressively throttled by
    // Chromium/Safari, so Supabase's internal auto-refresh timer often does
    // not run and the access_token can expire well before we actually notice.
    const IDLE_THRESHOLD_MS = 2 * 60 * 1000 // 2 minutes
    // Refresh proactively when the access_token is this close to expiring.
    const REFRESH_WINDOW_SECONDS = 120 // 2 minutes
    // Coalesce visibilitychange + focus + pageshow firing in quick succession
    // for the same wake event.
    const WAKE_COALESCE_MS = 1500

    /**
     * Quietly bring the Supabase session up to date if it is close to (or
     * past) expiry. Updates cookies via the browser client so the *next*
     * RSC fetch initiated by the user's navigation passes middleware.
     *
     * Returns true if a refresh was actually attempted, false otherwise.
     */
    const ensureFreshSession = async (): Promise<boolean> => {
      if (isRefreshingAfterIdleRef.current) return false
      isRefreshingAfterIdleRef.current = true

      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getSession()
        const session = data?.session

        if (!session) {
          // No local session at all. Don't force-navigate here — middleware
          // will redirect the next request. Forcing window.location now would
          // interrupt a user that is actively typing/clicking in-page.
          return false
        }

        const nowSeconds = Math.floor(Date.now() / 1000)
        const expiresAt = session.expires_at ?? 0
        const secondsToExpiry = expiresAt - nowSeconds

        if (secondsToExpiry <= REFRESH_WINDOW_SECONDS) {
          await supabase.auth.refreshSession()
          return true
        }
        return false
      } catch (err) {
        console.warn('[layout-client] Session refresh on wake failed:', err)
        return false
      } finally {
        isRefreshingAfterIdleRef.current = false
      }
    }

    const handleWake = async (hiddenDuration: number) => {
      // Radix UI portals occasionally leave pointer-events: none on body
      // when the tab is hidden mid-animation. Always clear it.
      document.body.style.pointerEvents = ''

      if (hiddenDuration <= IDLE_THRESHOLD_MS) return
      if (wakeHandledRef.current) return
      wakeHandledRef.current = true

      try {
        await ensureFreshSession()
        // IMPORTANT: do not call router.refresh() here. Letting the next
        // user-initiated navigation use the freshly written cookies avoids
        // the Next 16 / React 19 transition deadlock that froze the
        // sidebar after wake.
      } finally {
        // Allow another wake handling after the coalesce window.
        setTimeout(() => {
          wakeHandledRef.current = false
        }, WAKE_COALESCE_MS)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSinceRef.current = Date.now()
      } else if (document.visibilityState === 'visible') {
        const hiddenDuration = hiddenSinceRef.current
          ? Date.now() - hiddenSinceRef.current
          : 0
        hiddenSinceRef.current = null
        void handleWake(hiddenDuration)
      }
    }

    // Window focus is a useful complement: some browsers (Safari in
    // particular) don't always fire visibilitychange when returning from
    // another OS window while the tab technically stayed "visible".
    const handleWindowFocus = () => {
      if (document.visibilityState !== 'visible') return
      const hiddenDuration = hiddenSinceRef.current
        ? Date.now() - hiddenSinceRef.current
        : 0
      hiddenSinceRef.current = null
      void handleWake(hiddenDuration)
    }

    // bfcache restore: Safari/Firefox/Chrome may keep the entire page in
    // memory and just re-display it. visibilitychange / focus do not always
    // fire reliably in that case. `pageshow` with persisted=true is the
    // canonical signal.
    const handlePageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return
      // Treat bfcache restore as a long idle to force a session re-check.
      void handleWake(IDLE_THRESHOLD_MS + 1)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)
    window.addEventListener('pageshow', handlePageShow)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [router])

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
        <Toaster />
      </div>
    )
  }

  return (
    <div className={cn(
      "flex min-h-[100dvh] w-full bg-background",
      isLayoutCollapsed ? "collapsed" : ""
    )}>
        {fetchError && (
          <div className="fixed bottom-4 right-4 bg-destructive text-destructive-foreground p-4 rounded-md shadow-lg z-50">
            {t('layout.topbar.error') || 'Error'}: {fetchError === 'LAYOUT_ERROR_LOADING_SEGMENTS' ? (t('layout.topbar.errorLoadingSegments') || 'Error loading segments') : fetchError}
          </div>
        )}
        {isLoginPage ? (
          // Para la página de login, solo mostrar el contenido sin layout
          <div className="min-h-[100dvh] w-full">
            {children}
          </div>
        ) : (
          // Para el resto de páginas, mostrar el layout completo
          <div className="flex overflow-visible relative min-h-[100dvh] w-full">
            <Sidebar 
              isCollapsed={isLayoutCollapsed} 
              onCollapse={handleCollapse}
              isMobileOpen={isMobileSidebarOpen}
              onMobileClose={() => setIsMobileSidebarOpen(false)}
              className="flex-none fixed left-0 top-0 h-screen z-[210]"
            />
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
                onMobileToggle={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                segments={segments}
                className="fixed top-0 right-0 left-0"
                style={{ paddingLeft: isMobile ? 0 : isLayoutCollapsed ? 64 : 256 }}
                breadcrumb={customBreadcrumb}
                isExperimentDetailPage={isExperimentDetailPage}
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
                  (isChatPage) ? "flex flex-col overflow-hidden" : (isRobotsPage ? "flex flex-col overflow-visible" : "overflow-visible")
                )} 
                style={{
                  ...(isAppPage ? { height: isRobotsPage ? '100dvh' : 'calc(100dvh - 64px)' } : {}),
                  '--topbar-height': '64px'
                } as React.CSSProperties}
              >
                {children}
              </main>
            </div>
          </div>
        )}
        <Toaster />
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
  const [segments, setSegments] = useState<Segment[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [breadcrumbFromEvent, setBreadcrumbFromEvent] = useState<React.ReactNode>(null)
  const [customTitle, setCustomTitle] = useState<string | null>(null)

  // Use the page refresh prevention hook
  const { shouldPreventRefresh, isCreateEditRoute } = usePageRefreshPrevention()

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
        setFetchError('LAYOUT_ERROR_LOADING_SEGMENTS')
        setRetryCount(prev => prev + 1)
      }
    }, 500)

    return () => clearTimeout(fetchTimer)
  }, [isMounted, pathname])

  // Renderizar un estado de carga simple hasta que la aplicación esté hidratada
  if (!isMounted) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        {/* Placeholder mientras se carga el cliente */}
      </div>
    )
  }

  // Mostrar la página con posible indicador de error
  // NOTE: ThemeProvider, SiteProvider, and LayoutProvider are NOT wrapped here.
  // They already exist in Providers.tsx (app/providers/Providers.tsx) which wraps
  // the entire app. Duplicating them here created two independent React context
  // instances -- RobotsProvider (in Providers.tsx) read from the OUTER SiteProvider
  // while page components read from the INNER one, causing state desync.
  return (
    <NotificationsProvider>
      <LayoutClientInner
        pathname={pathname}
        segments={segments}
        breadcrumbFromEvent={breadcrumbFromEvent}
        customTitle={customTitle}
        fetchError={fetchError}
        isExperimentDetailPage={isExperimentDetailPage}
      >
        {children}
      </LayoutClientInner>
    </NotificationsProvider>
  )
} 