import { createBrowserClient } from '@supabase/ssr'

// Cliente único para toda la aplicación
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null
let clientCreationTimestamp: number | null = null
let clientCreationError: Error | null = null
let isClientCreating = false

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

  // No crear el cliente si estamos en el servidor
  if (isServerSide()) {
    console.warn('Usando cliente Supabase MOCK (server-side)')
    return createMockClient('server-side')
  }
  
  // Verificar si hay un error previo
  if (clientCreationError) {
    console.warn('Usando cliente mock debido a error previo:', clientCreationError.message)
    return createMockClient('previous-error')
  }
  
  // Prevenir creaciones concurrentes
  if (isClientCreating) {
    console.warn('La creación del cliente ya está en progreso, devolviendo cliente mock temporal')
    return createMockClient('creating-in-progress')
  }

  // Si ya existe un cliente y fue creado hace menos de 5 minutos, devolver esa instancia
  if (supabaseClient && clientCreationTimestamp) {
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000
    if (now - clientCreationTimestamp < fiveMinutes) {
      return supabaseClient
    }
  }

  try {
    // Establecer flag para evitar creaciones concurrentes
    isClientCreating = true
    
    // Solo crear un nuevo cliente si no existe o si ha expirado
    console.log('Creando nuevo cliente Supabase...')
    
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
        // Configuración adicional para Realtime
        realtime: {
          params: {
            eventsPerSecond: 10
          },
          // Configuración básica de timeout
          timeout: 60000 // 60 segundos de timeout para la conexión inicial
        },
        global: {
          headers: {
            'X-Supabase-Cache-Control': '0'
          }
        }
      }
    )
    
    // Limpiar errores previos si todo salió bien
    clientCreationError = null
    isClientCreating = false
    
    console.log('Cliente Supabase creado correctamente')
    return supabaseClient
  } catch (error) {
    // Guardar el error para verificaciones futuras
    clientCreationError = error instanceof Error ? error : new Error(String(error))
    console.error('Error creando cliente Supabase:', clientCreationError)
    
    // Limpiar flag
    isClientCreating = false
    
    // Devolver un cliente dummy en caso de error para evitar un fallo completo
    return createMockClient('error')
  }
}

/**
 * Crea un cliente mock para situaciones donde no se puede crear el cliente real
 */
function createMockClient(reason: string) {
  console.log(`Usando cliente Supabase MOCK (${reason})`)
  
  return {
    _isMock: true,
    auth: {
      getSession: async () => {
        console.log('Mock: getSession() llamado')
        return { 
          data: { session: null }, 
          error: { message: `Cliente mock (${reason}): No hay sesión disponible` } 
        }
      },
      onAuthStateChange: () => {
        console.log('Mock: onAuthStateChange() llamado')
        return { 
          data: { 
            subscription: { 
              unsubscribe: () => console.log('Mock: unsubscribe() llamado') 
            } 
          } 
        }
      },
      signInWithPassword: async () => {
        console.log('Mock: signInWithPassword() llamado')
        return {
          data: { user: null, session: null },
          error: { message: `Cliente mock (${reason}): No se puede iniciar sesión` }
        }
      },
      signInWithOAuth: async () => {
        console.log('Mock: signInWithOAuth() llamado')
        return {
          data: { provider: null, url: null },
          error: { message: `Cliente mock (${reason}): No se puede iniciar sesión con OAuth` }
        }
      },
      signUp: async () => {
        console.log('Mock: signUp() llamado')
        return {
          data: { user: null, session: null },
          error: { message: `Cliente mock (${reason}): No se puede registrar` }
        }
      },
      signOut: async () => {
        console.log('Mock: signOut() llamado')
        return {
          error: null
        }
      }
    },
    from: (table: string) => ({
      select: (columns?: string) => {
        console.log(`Mock: select(${columns}) llamado para la tabla ${table}`)
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
        console.log(`Mock: insert() llamado para la tabla ${table}`)
        return { 
          data: null, 
          error: { message: `Cliente mock (${reason}): No se pueden insertar datos` } 
        }
      },
      update: (data: any) => {
        console.log(`Mock: update() llamado para la tabla ${table}`)
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
        console.log(`Mock: delete() llamado para la tabla ${table}`)
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
        console.log(`Mock: on(${event}) llamado para el canal ${channel}`)
        return { 
          subscribe: () => ({ 
            unsubscribe: () => console.log('Mock: channel.unsubscribe() llamado') 
          }) 
        }
      }
    })
  }
} 