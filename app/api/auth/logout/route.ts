import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Indicar a Next.js que esta ruta es dinámica
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
  // Añadir cualquier otra cookie que pueda estar relacionada con la autenticación
  'next-auth.session-token',
  'next-auth.callback-url',
  'next-auth.csrf-token',
  '__Secure-next-auth.session-token',
  '__Host-next-auth.csrf-token'
]

export async function GET(request: Request) {
  try {
    // Determinar la URL base de la aplicación
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    
    // Obtener parámetros de la URL
    const url = new URL(request.url)
    const isEmergency = url.searchParams.has('emergency')
    const clearType = url.searchParams.get('clear') || 'standard'
    
    // Crear cliente de Supabase
    const supabase = await createClient()
    
    // Cerrar sesión en Supabase
    const { error } = await supabase.auth.signOut({
      scope: 'global' // Asegurarse de cerrar sesión en todos los dispositivos
    })
    
    if (error) {
      console.error('Error in Supabase signOut:', error)
    }
    
    // Crear respuesta y redirigir a la página de login con parámetros para evitar caché
    const timestamp = Date.now()
    const response = NextResponse.redirect(
      `${appUrl}/auth?logout=true&t=${timestamp}&clear=${clearType}${isEmergency ? '&emergency=true' : ''}`
    )
    
    // Limpiar todas las cookies relacionadas con la autenticación
    SUPABASE_COOKIES.forEach(cookieName => {
      // Eliminar la cookie de la respuesta
      response.cookies.delete(cookieName)
      
      // También establecer la cookie con una fecha de expiración en el pasado
      response.cookies.set(cookieName, '', { 
        expires: new Date(0),
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 0
      })
    })
    
    // Establecer encabezados para evitar el almacenamiento en caché
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('Surrogate-Control', 'no-store')
    
    return response
  } catch (error) {
    console.error('Error in logout:', error)
    
    // En caso de error, intentar redirigir a la página de login
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const timestamp = Date.now()
      const response = NextResponse.redirect(`${appUrl}/auth?logout=true&error=true&t=${timestamp}`)
      
      // Intentar limpiar cookies incluso en caso de error
      SUPABASE_COOKIES.forEach(cookieName => {
        // Eliminar la cookie
        response.cookies.delete(cookieName)
        
        // También establecer la cookie con una fecha de expiración en el pasado
        response.cookies.set(cookieName, '', { 
          expires: new Date(0),
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 0
        })
      })
      
      // Establecer encabezados para evitar el almacenamiento en caché
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')
      response.headers.set('Surrogate-Control', 'no-store')
      
      return response
    } catch (finalError) {
      console.error('Final error in logout:', finalError)
      // Si todo falla, devolver un error JSON
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
  }
} 