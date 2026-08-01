import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

// Hacer que esta ruta sea siempre dinámica
export const dynamic = 'force-dynamic'

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
  'sb-provider',
  'next-auth.session-token',
  'next-auth.callback-url',
  'next-auth.csrf-token',
  '__Secure-next-auth.session-token',
  '__Host-next-auth.csrf-token',
  'market_fit_demo_site_id'
]

export async function GET(request: Request) {
  try {
    // Crear cliente de Supabase
    const supabase = await createClient()
    
    // Cerrar sesión en Supabase
    await supabase.auth.signOut({ scope: 'global' })
    
    // Limpiar cookies - await the cookies function first
    const cookieStore = await cookies()
    SUPABASE_COOKIES.forEach(cookieName => {
      cookieStore.delete(cookieName)
    })
    
    // Crear respuesta con redirección usando Response nativa
    const headers = new Headers({
      'Location': '/auth',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    })
    
    return new Response(null, {
      status: 302,
      headers
    })
  } catch (error) {
    console.error('Error in logout:', error)
    
    // En caso de error, crear una respuesta de redirección simple
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/auth' }
    })
  }
} 