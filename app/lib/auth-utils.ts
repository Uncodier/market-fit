import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

interface Auth0User {
  sub: string
  email: string
  name?: string
  picture?: string
}

/**
 * Sincroniza un usuario de Auth0 con Supabase
 * @param auth0User Datos del usuario de Auth0
 * @returns ID de usuario en Supabase
 */
export async function syncAuth0User(auth0User: Auth0User): Promise<string> {
  try {
    console.log('Sincronizando usuario de Auth0 con Supabase:', auth0User.email)
    
    // Por ahora, simplemente devolvemos el ID de Auth0
    // En producción, aquí deberías implementar la lógica para sincronizar con Supabase
    return auth0User.sub
  } catch (error) {
    console.error('Error sincronizando usuario:', error)
    throw error
  }
}

/**
 * Crea un cliente de Supabase configurado con el token de Auth0
 * @param auth0Token Token JWT de Auth0
 * @returns Cliente de Supabase
 */
export function createSupabaseClientWithAuth0(auth0Token?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  const cookieStore = cookies()
  
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options })
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: '', ...options })
      },
    },
    global: {
      headers: auth0Token 
        ? { Authorization: `Bearer ${auth0Token}` }
        : undefined,
    },
  })
} 