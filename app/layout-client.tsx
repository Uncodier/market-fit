"use client"

import { Sidebar } from "./components/navigation/Sidebar"
import { TopBar } from "./components/navigation/TopBar"
import { usePathname } from "next/navigation"
import { TooltipProvider } from "./components/ui/tooltip"
import { useState, useEffect } from "react"
import { SiteProvider } from "./context/SiteContext"
import { cn } from "@/lib/utils"
import { AuthProvider } from './components/auth/auth-provider'
import { Toaster } from "./components/ui/sonner"
import { createClient } from "@/lib/supabase/client"
import { type Segment } from "./requirements/types"
import { ThemeProvider } from "./context/ThemeContext"

const navigationTitles: Record<string, { title: string, helpText?: string }> = {
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
  
  // Estado para guardar el breadcrumb
  const [breadcrumbFromEvent, setBreadcrumbFromEvent] = useState<React.ReactNode>(null);
  
  // Escuchar eventos de breadcrumb
  useEffect(() => {
    const handleBreadcrumbUpdate = (event: any) => {
      if (event.detail && event.detail.breadcrumb) {
        setBreadcrumbFromEvent(event.detail.breadcrumb);
      }
    };
    
    window.addEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener);
    
    return () => {
      window.removeEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener);
    };
  }, []);
  
  // Si la ruta actual comienza con /chat, extraer el breadcrumb de los props de los hijos
  let customTitle: string | null = null;
  let customHelpText: string | null = null;
  let customBreadcrumb: React.ReactNode = null;
  const isChatPage = pathname && pathname.startsWith('/chat');
  
  if (isChatPage) {
    customTitle = "Chat";
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
  
  const currentPage = customTitle 
    ? { title: customTitle, helpText: customHelpText }
    : (navigationTitles[pathname] || { title: "Dashboard" });
    
  const [segments, setSegments] = useState<Segment[]>([])
  const [isMounted, setIsMounted] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  
  const [isCollapsed, setIsCollapsed] = useState(false) // Valor por defecto seguro

  // Manejar la inicialización de localStorage después de la hidratación
  useEffect(() => {
    setIsMounted(true)
    
    // Limpiar localStorage al iniciar
    cleanLocalStorageOnStartup()
    
    // Ahora es seguro acceder a localStorage
    const saved = localStorage.getItem('sidebarCollapsed')
    if (saved !== null) {
      try {
        setIsCollapsed(JSON.parse(saved))
      } catch (error) {
        console.error("Error parsing sidebar collapsed state:", error)
      }
    }
  }, [])

  useEffect(() => {
    if (!isMounted) return // No guardar en localStorage durante SSR o antes de la hidratación
    
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed))
  }, [isCollapsed, isMounted])

  useEffect(() => {
    if (!isMounted) return // No ejecutar antes de la hidratación
    
    // Resetear el contador de reintentos al cambiar de ruta
    setRetryCount(0)
    setFetchError(null)
    
    async function fetchSegments() {
      // Solo intentar obtener segmentos para páginas específicas
      if (!['/experiments', '/requirements'].includes(pathname)) {
        setSegments([])
        return
      }
      
      // Limitar los reintentos a 3 veces
      if (retryCount > 2) {
        console.log("Máximo de reintentos alcanzado, no se intentará cargar segmentos nuevamente")
        // Como último recurso, intentar limpiar el localStorage si seguimos teniendo problemas
        if (retryCount === 3) {
          try {
            console.log("Intentando limpiar localStorage para currentSiteId como último recurso...")
            const rawSiteId = localStorage.getItem("currentSiteId")
            if (rawSiteId && rawSiteId.includes('"')) {
              const cleanedId = rawSiteId.replace(/["']/g, '')
              localStorage.setItem("currentSiteId", cleanedId)
              console.log("ID del sitio limpiado como último recurso:", cleanedId)
              // Forzar una recarga de la página para reiniciar todo limpiamente
              window.location.reload()
            }
          } catch (e) {
            console.error("Error final al intentar limpiar localStorage:", e)
          }
        }
        return
      }
      
      try {
        // Inicializar el cliente de Supabase
        console.log("Iniciando cliente de Supabase...")
        const supabase = createClient()
        
        // Verificar si hay una sesión activa
        console.log("Obteniendo sesión de usuario...")
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error("Error al obtener la sesión:", sessionError)
          setFetchError(`Error de sesión: ${sessionError.message || "Error desconocido"}`)
          setSegments([])
          return
        }
        
        if (!session) {
          console.log("No hay sesión activa de usuario")
          setSegments([])
          return
        }
        
        // Obtener el sitio actual desde localStorage y limpiarlo de comillas extras
        console.log("Obteniendo ID del sitio actual...")
        const rawSiteId = localStorage.getItem("currentSiteId")
        console.log("ID del sitio obtenido (raw):", rawSiteId)
        
        // Limpiar el ID del sitio
        let savedSiteId: string | null = null
        
        // Intentar parsear como JSON primero (por si está guardado como string JSON)
        if (rawSiteId) {
          try {
            const parsed = JSON.parse(rawSiteId)
            if (typeof parsed === 'string') {
              savedSiteId = parsed.replace(/["']/g, '')
            }
          } catch {
            // Si no es JSON, intentar limpiar directamente
            savedSiteId = rawSiteId.replace(/["']/g, '')
          }
        }
        
        console.log("ID del sitio limpio:", savedSiteId)
        
        // Verificar y corregir localStorage si hay inconsistencias
        if (rawSiteId && savedSiteId && rawSiteId !== savedSiteId) {
          console.log("Corrigiendo ID del sitio en localStorage...")
          localStorage.setItem("currentSiteId", savedSiteId)
        }
        
        if (!savedSiteId || savedSiteId === "default") {
          console.log("No hay sitio válido seleccionado")
          setSegments([])
          return
        }
        
        // Consultar los segmentos para el sitio
        console.log(`Consultando segmentos para el sitio: ${savedSiteId}...`)
        const { data, error } = await supabase
          .from('segments')
          .select('id, name, description')
          .eq('site_id', savedSiteId)

        // Manejar la respuesta
        if (error) {
          const errorMessage = error.message || JSON.stringify(error)
          console.error(`Error al cargar segmentos: ${errorMessage}`, error)
          setFetchError(`Error al cargar segmentos: ${errorMessage}`)
          setSegments([])
          
          // Si el error es de formato UUID, intentar corregir localStorage
          if (error.code === '22P02' && rawSiteId) {
            console.log("Intentando corregir UUID en localStorage...")
            try {
              // Último intento desesperado: eliminar cualquier caracter no alfanumérico o guión
              const lastAttempt = rawSiteId.replace(/[^a-zA-Z0-9-]/g, '')
              localStorage.setItem("currentSiteId", lastAttempt)
              console.log("UUID corregido en localStorage con método radical:", lastAttempt)
            } catch (e) {
              console.error("No se pudo corregir UUID en localStorage:", e)
            }
          }
          
          // Incrementar contador de reintentos
          setRetryCount(prev => prev + 1)
        } else if (!data) {
          console.log("No se recibieron datos de segmentos (null)")
          setSegments([])
        } else {
          console.log(`Segmentos cargados correctamente: ${data.length}`)
          setSegments(data)
          setFetchError(null)
        }
      } catch (error: any) {
        const errorMessage = error?.message || "Error desconocido"
        console.error(`Error general al cargar segmentos: ${errorMessage}`, error)
        setFetchError(`Error general: ${errorMessage}`)
        setSegments([])
        
        // Incrementar contador de reintentos
        setRetryCount(prev => prev + 1)
      }
    }

    // Ejecutar con un pequeño retraso para permitir que otras operaciones se estabilicen
    const timer = setTimeout(() => {
      fetchSegments()
    }, 100)
    
    return () => clearTimeout(timer)
  }, [pathname, isMounted, retryCount])

  const handleCollapse = () => {
    setIsCollapsed((prev: boolean) => !prev)
  }

  // Determinar si estamos en la página de login
  const isLoginPage = pathname === '/auth/login'

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
    <AuthProvider>
      <SiteProvider>
        <ThemeProvider defaultTheme="system" storageKey="theme">
          <TooltipProvider>
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
              <div className="flex h-fit overflow-visible relative min-h-screen">
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
                    title={currentPage.title || ""}
                    helpText={currentPage.helpText || undefined}
                    isCollapsed={isCollapsed}
                    onCollapse={handleCollapse}
                    segments={segments}
                    className="fixed top-0 right-0 z-10"
                    style={{ 
                      left: isCollapsed ? '4rem' : '16rem',
                    }}
                    breadcrumb={customBreadcrumb}
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
            )}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </SiteProvider>
    </AuthProvider>
  )
} 