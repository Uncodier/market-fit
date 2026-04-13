import { createBrowserClient } from '@supabase/ssr'

// Singleton client for the entire application
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null
let clientCreationTimestamp: number | null = null
let clientCreationError: Error | null = null
let clientCreationErrorTimestamp: number | null = null
const ERROR_RECOVERY_MS = 30_000

/**
 * Limpia un UUID de comillas extras o caracteres no válidos
 * @param id Posible UUID con formato incorrecto
 * @returns UUID limpio o null si no es válido
 */
function cleanUUID(id: string | null): string | null {
  if (!id) return null
  
  try {
    // Eliminar comillas extras si existen
    let cleaned = id.replace(/["']/g, '')
    
    // Verificar el formato básico de UUID después de limpiar
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleaned)) {
      return cleaned
    }
    
    // Caso especial para "default" u otros valores especiales
    if (cleaned === "default") return cleaned
    
    console.warn("UUID inválido después de limpieza:", id, "->", cleaned)
    return id // En caso de duda, devolvemos el original para evitar loops
  } catch (error) {
    console.error("Error al limpiar UUID:", error)
    return id
  }
}

/**
 * Verifica si el código está ejecutándose en el servidor
 */
function isServerSide(): boolean {
  return (
    typeof window === 'undefined' || 
    typeof document === 'undefined' ||
    // Verificación adicional para entornos especiales como Next.js
    typeof process !== 'undefined' && process.env?.NEXT_RUNTIME === 'nodejs'
  )
}

/**
 * Crea o devuelve una instancia del cliente de Supabase
 * Con mejor manejo de errores y diagnóstico
 */
export function createClient() {
  // Verificar variables de entorno
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('NEXT_PUBLIC_SUPABASE_URL no está definida')
    return createMockClient('missing-env')
  }
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY no está definida')
    return createMockClient('missing-env')
  }

  if (isServerSide()) {
    console.warn('Usando cliente Supabase MOCK (server-side)')
    return createMockClient('server-side')
  }
  
  // If a previous creation attempt failed, allow retry after ERROR_RECOVERY_MS
  if (clientCreationError) {
    const elapsed = clientCreationErrorTimestamp ? Date.now() - clientCreationErrorTimestamp : Infinity
    if (elapsed < ERROR_RECOVERY_MS) {
      console.warn('Usando cliente mock debido a error previo:', clientCreationError.message)
      return createMockClient('previous-error')
    }
    clientCreationError = null
    clientCreationErrorTimestamp = null
  }

  if (supabaseClient) {
    return supabaseClient
  }

  try {
    clientCreationTimestamp = Date.now()
    
    supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            if (isServerSide()) return undefined
            
            try {
              return document.cookie
                .split('; ')
                .find((row) => row.startsWith(`${name}=`))
                ?.split('=')[1]
            } catch (error) {
              console.error('Error obteniendo cookie:', error)
              return undefined
            }
          },
          set(name: string, value: string, options: { maxAge?: number; path?: string; domain?: string; secure?: boolean }) {
            if (isServerSide()) return
            
            try {
              let cookie = `${name}=${value}`
              if (options?.path) cookie += `; path=${options.path}`
              if (options?.maxAge) cookie += `; max-age=${options.maxAge}`
              if (options?.domain) cookie += `; domain=${options.domain}`
              if (options?.secure) cookie += `; secure`
              document.cookie = cookie
            } catch (error) {
              console.error('Error estableciendo cookie:', error)
            }
          },
          remove(name: string, options: { path?: string; domain?: string }) {
            if (isServerSide()) return
            
            try {
              let cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:01 GMT`
              if (options?.path) cookie += `; path=${options.path}`
              if (options?.domain) cookie += `; domain=${options.domain}`
              document.cookie = cookie
            } catch (error) {
              console.error('Error eliminando cookie:', error)
            }
          }
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          },
          timeout: 60000
        },
        global: {
          headers: {
            'X-Supabase-Cache-Control': '0'
          }
        }
      }
    )
    
    clientCreationError = null
    clientCreationErrorTimestamp = null
    
    return supabaseClient
  } catch (error) {
    clientCreationError = error instanceof Error ? error : new Error(String(error))
    clientCreationErrorTimestamp = Date.now()
    console.error('Error creando cliente Supabase:', clientCreationError)
    
    return createMockClient('error')
  }
}

/**
 * Crea un cliente mock para situaciones donde no se puede crear el cliente real
 */
function createMockClient(reason: string) {
  
  return {
    _isMock: true,
    auth: {
      getSession: async () => {
        return { 
          data: { session: null }, 
          error: { message: `Cliente mock (${reason}): No hay sesión disponible` } 
        }
      },
      onAuthStateChange: () => {
        return { 
          data: { 
            subscription: { 
              unsubscribe: () => console.log('Mock: unsubscribe() llamado') 
            } 
          } 
        }
      },
      signInWithPassword: async () => {
        return {
          data: { user: null, session: null },
          error: { message: `Cliente mock (${reason}): No se puede iniciar sesión` }
        }
      },
      signInWithOAuth: async () => {
        return {
          data: { provider: null, url: null },
          error: { message: `Cliente mock (${reason}): No se puede iniciar sesión con OAuth` }
        }
      },
      signUp: async () => {
        return {
          data: { user: null, session: null },
          error: { message: `Cliente mock (${reason}): No se puede registrar` }
        }
      },
      signOut: async () => {
        return {
          error: null
        }
      }
    },
    from: (table: string) => ({
      select: (columns?: string) => {
        return { 
          eq: (column: string, value: any) => ({ 
            data: null, 
            error: { message: `Cliente mock (${reason}): No se pueden obtener datos` } 
          }),
          single: () => ({
            data: null,
            error: { message: `Cliente mock (${reason}): No se pueden obtener datos` }
          }),
          order: (column: string, options?: any) => ({ 
            data: null, 
            error: { message: `Cliente mock (${reason}): No se pueden obtener datos` } 
          }) 
        }
      },
      insert: (data: any) => {
        return { 
          data: null, 
          error: { message: `Cliente mock (${reason}): No se pueden insertar datos` } 
        }
      },
      update: (data: any) => {
        return { 
          eq: (column: string, value: any) => ({ 
            select: () => ({
              single: () => ({
                data: null, 
                error: { message: `Cliente mock (${reason}): No se pueden actualizar datos` }
              })
            }),
            data: null, 
            error: { message: `Cliente mock (${reason}): No se pueden actualizar datos` } 
          }) 
        }
      },
      delete: () => {
        return { 
          eq: (column: string, value: any) => ({ 
            data: null, 
            error: { message: `Cliente mock (${reason}): No se pueden eliminar datos` } 
          }) 
        }
      }
    }),
    channel: (channel: string) => ({
      on: (event: string, callback: any) => {
        return { 
          subscribe: () => ({ 
            unsubscribe: () => console.log('Mock: channel.unsubscribe() llamado') 
          }) 
        }
      }
    })
  }
} 