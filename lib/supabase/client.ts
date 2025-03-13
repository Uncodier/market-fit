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
  if (typeof window === 'undefined') {
    console.warn('Intento de crear cliente Supabase en el lado del servidor')
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
            if (typeof document === 'undefined') return undefined
            
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
            if (typeof document === 'undefined') return
            
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
            if (typeof document === 'undefined') return
            
            try {
              let cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:01 GMT`
              if (options?.path) cookie += `; path=${options.path}`
              if (options?.domain) cookie += `; domain=${options.domain}`
              document.cookie = cookie
            } catch (error) {
              console.error('Error eliminando cookie:', error)
            }
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
      }
    },
    from: () => ({
      select: () => {
        console.log('Mock: select() llamado')
        return { 
          eq: () => ({ 
            data: null, 
            error: { message: `Cliente mock (${reason}): No se pueden obtener datos` } 
          }), 
          order: () => ({ 
            data: null, 
            error: { message: `Cliente mock (${reason}): No se pueden obtener datos` } 
          }) 
        }
      },
      insert: () => {
        console.log('Mock: insert() llamado')
        return { 
          data: null, 
          error: { message: `Cliente mock (${reason}): No se pueden insertar datos` } 
        }
      },
      update: () => {
        console.log('Mock: update() llamado')
        return { 
          eq: () => ({ 
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
        console.log('Mock: delete() llamado')
        return { 
          eq: () => ({ 
            data: null, 
            error: { message: `Cliente mock (${reason}): No se pueden eliminar datos` } 
          }) 
        }
      }
    }),
    channel: () => ({
      on: () => {
        console.log('Mock: on() llamado')
        return { 
          subscribe: () => ({ 
            unsubscribe: () => console.log('Mock: channel.unsubscribe() llamado') 
          }) 
        }
      }
    })
  }
} 