import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Lista específica y exacta de rutas públicas permitidas
const ALLOWED_PUBLIC_PATHS = [
  '/auth',
  '/auth/callback',
  '/auth/logout'
]

// IMPORTANTE: Excluir completamente recursos estáticos
function isStaticOrResourceFile(pathname: string): boolean {
  return pathname.includes('/_next/') || 
         pathname.includes('/static/') ||
         pathname.startsWith('/__next') ||
         pathname.startsWith('/favicon') ||
         /\.[a-z0-9]+$/i.test(pathname) // Cualquier archivo con extensión
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Imprimir la ruta que se está procesando (solo en desarrollo)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Middleware] Procesando ruta: ${pathname}`)
  }
  
  // NUNCA procesar recursos estáticos - siempre permitir acceso
  if (isStaticOrResourceFile(pathname)) {
    return NextResponse.next()
  }
  
  // Redirigir /auth/login a /auth para mantener una única ruta de autenticación
  if (pathname === '/auth/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    url.search = request.nextUrl.search // Mantener los query params
    return NextResponse.redirect(url)
  }
  
  // Si es una ruta pública conocida, permitir
  if (ALLOWED_PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }
  
  try {
    // Crear el cliente de Supabase
    const res = NextResponse.next()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return request.cookies.get(name)?.value
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
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      // Si no hay sesión, redirigir a login
      const url = request.nextUrl.clone()
      url.pathname = '/auth'
      url.search = `?returnTo=${encodeURIComponent(pathname)}`
      return NextResponse.redirect(url)
    }

    // Usuario autenticado: permitir acceso
    return res
  } catch (error) {
    console.error('[Middleware] Error:', error)
    
    // En caso de error, redirigir a login
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    url.search = `?returnTo=${encodeURIComponent(pathname)}`
    
    return NextResponse.redirect(url)
  }
}

// Configuración que excluye explícitamente recursos estáticos
export const config = {
  matcher: [
    // Excluir explícitamente recursos estáticos y API routes específicas
    '/((?!_next/|static/|favicon|manifest.json).*)'
  ]
} 