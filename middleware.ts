import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define las rutas protegidas que requieren autenticación
const PROTECTED_ROUTES = [
  '/dashboard',
  '/profile',
  '/settings',
  '/experiments',
  '/segments'
]

// Define las rutas de autenticación
const AUTH_ROUTES = ['/auth']

export async function middleware(req: NextRequest) {
  try {
    const res = NextResponse.next()
    
    // Crear el cliente de Supabase con configuración explícita de cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return req.cookies.get(name)?.value
          },
          set(name, value, options) {
            res.cookies.set(name, value, options)
          },
          remove(name, options) {
            res.cookies.set(name, '', { ...options, maxAge: 0 })
          }
        }
      }
    )
    
    // Verificar la sesión
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Obtener la ruta actual
    const path = req.nextUrl.pathname

    // Si es una ruta de autenticación
    if (path.startsWith('/auth')) {
      // Si el usuario está autenticado, redirigir al dashboard o returnTo
      if (session) {
        const returnTo = req.nextUrl.searchParams.get('returnTo') || '/dashboard'
        const redirectUrl = new URL(returnTo, req.url)
        return NextResponse.redirect(redirectUrl)
      }
      // Si no está autenticado, permitir acceso a la página de auth
      return res
    }

    // Si es una ruta protegida
    if (PROTECTED_ROUTES.some(route => path.startsWith(route))) {
      // Si no hay sesión, redirigir a auth con returnTo
      if (!session) {
        const redirectUrl = new URL('/auth', req.url)
        redirectUrl.searchParams.set('returnTo', path)
        return NextResponse.redirect(redirectUrl)
      }
    }

    // Para cualquier otra ruta, permitir el acceso
    return res
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

// Configurar el matcher para las rutas que queremos que pasen por el middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
} 