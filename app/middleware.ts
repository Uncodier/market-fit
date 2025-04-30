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

// Rutas que deben ser excluidas del middleware completamente
const EXCLUDED_PATHS = [
  '/api/auth/logout'
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Imprimir la ruta que se está procesando (solo en desarrollo)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Middleware] Procesando ruta: ${pathname}`)
  }
  
  // Handle OPTIONS request for preflight checks (CORS)
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    
    // Add the CORS headers to the response
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-api-secret');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    
    // Establecer CSP headers para WebSockets
    response.headers.set('Content-Security-Policy', 
      "default-src 'self'; " +
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in " +
      "http://localhost:3001 http://192.168.87.25:3001 http://192.168.87.34:* http://192.168.87.34 https://192.168.87.34:* " +
      "http://192.168.87.49/* http://192.168.87.49:* https://192.168.87.49/* https://192.168.87.49:*; " +
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:;"
    );
    
    return response;
  }
  
  // NUNCA procesar recursos estáticos - siempre permitir acceso
  if (isStaticOrResourceFile(pathname)) {
    return NextResponse.next()
  }
  
  // Excluir rutas específicas del middleware completamente
  if (EXCLUDED_PATHS.some(path => pathname === path || pathname.startsWith(path))) {
    console.log(`[Middleware] Ruta excluida: ${pathname}`)
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
    const res = NextResponse.next();
    
    // Add CORS headers to all responses
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-api-secret');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    
    // Añadir CSP header para permitir WebSockets
    res.headers.set('Content-Security-Policy', 
      "default-src 'self'; " +
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in " +
      "http://localhost:3001 http://192.168.87.25:3001 http://192.168.87.34:* http://192.168.87.34 https://192.168.87.34:* " +
      "http://192.168.87.49/* http://192.168.87.49:* https://192.168.87.49/* https://192.168.87.49:*; " +
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:;"
    );
    
    return res;
  }
  
  try {
    // Crear el cliente de Supabase
    const res = NextResponse.next()
    
    // Add CORS headers to all responses
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-api-secret');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    
    // Añadir CSP header para permitir WebSockets
    res.headers.set('Content-Security-Policy', 
      "default-src 'self'; " +
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in " +
      "http://localhost:3001 http://192.168.87.25:3001 http://192.168.87.34:* http://192.168.87.34 https://192.168.87.34:* " +
      "http://192.168.87.49/* http://192.168.87.49:* https://192.168.87.49/* https://192.168.87.49:*; " +
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:;"
    );
    
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
    
    const res = NextResponse.next();
    
    // Ensure CORS headers are set even in case of error
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-api-secret');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    
    // Asegurar que el CSP header esté configurado incluso en caso de error
    res.headers.set('Content-Security-Policy', 
      "default-src 'self'; " +
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in " +
      "http://localhost:3001 http://192.168.87.25:3001 http://192.168.87.34:* http://192.168.87.34 https://192.168.87.34:* " +
      "http://192.168.87.49/* http://192.168.87.49:* https://192.168.87.49/* https://192.168.87.49:*; " +
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:;"
    );
    
    // En caso de error, redirigir a login
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    url.search = `?returnTo=${encodeURIComponent(pathname)}`
    
    return NextResponse.redirect(url)
  }
}

// Configuración que excluye explícitamente recursos estáticos y rutas de API
export const config = {
  matcher: [
    // Excluir explícitamente recursos estáticos y API routes específicas
    '/((?!_next/|static/|favicon|manifest.json|api/auth/logout).*)'
  ]
} 