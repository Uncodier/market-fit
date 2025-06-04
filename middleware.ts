export const dynamic = 'force-dynamic';

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

// Define API routes that need special cookie handling for authentication
const API_AUTH_ROUTES = [
  '/api/secure-tokens'
]

export async function middleware(req: NextRequest) {
  // Handle OPTIONS request for preflight checks (CORS)
  if (req.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    
    // Add the CORS headers to the response
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-api-secret');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    
    return response;
  }

  try {
    const res = NextResponse.next()
    
    // Add CORS headers to all responses
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-api-secret');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    
    // Current path for route-specific handling
    const path = req.nextUrl.pathname
    
    // Special handling for API auth routes
    const isApiAuthRoute = API_AUTH_ROUTES.some(route => path.startsWith(route))
    if (isApiAuthRoute) {
      console.log('Middleware: API route detected:', path);
      
      // For secure token APIs, simply pass through the request without
      // modifying any cookies or headers to avoid parsing issues
      return NextResponse.next();
    }
    
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
    const res = NextResponse.next()
    
    // Ensure CORS headers are set even in case of error
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-api-secret');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    
    return res
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
     * - api (API routes)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
} 