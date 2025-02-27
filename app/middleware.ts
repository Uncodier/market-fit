import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Lista específica y exacta de rutas públicas permitidas
const ALLOWED_PUBLIC_PATHS = [
  '/auth/login',
  '/api/auth/login',
  '/api/auth/callback',
  '/api/auth/logout'
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
  
  // Rutas específicas que deben ser protegidas
  const protectedRoutes = [
    '/',
    '/dashboard',
    '/segments',
    '/experiments',
    '/requirements',
    '/assets',
    '/leads',
    '/agents',
    '/profile',
    '/settings'
  ]
  
  // Verificar si la ruta actual debe ser protegida
  const shouldProtect = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  )
  
  // Si la ruta no necesita protección, continuar
  if (!shouldProtect) {
    return NextResponse.next()
  }
  
  // Si es una ruta pública conocida, permitir
  if (ALLOWED_PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }
  
  // Verificar autenticación
  const auth0Token = request.cookies.get('auth0_token')?.value
  
  // Si no hay token y la ruta debe estar protegida -> REDIRIGIR A LOGIN
  if (!auth0Token) {
    console.log(`Redirigiendo a login desde ${pathname}`)
    
    // Crear URL de redirección con returnTo
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.search = `?returnTo=${encodeURIComponent(pathname)}`
    
    return NextResponse.redirect(url)
  }
  
  // Usuario autenticado: permitir acceso y añadir token a headers
  const response = NextResponse.next()
  response.headers.set('Authorization', `Bearer ${auth0Token}`)
  
  return response
}

// Configuración que excluye explícitamente recursos estáticos
export const config = {
  matcher: [
    // Excluir explícitamente recursos estáticos y API routes específicas
    '/((?!_next/|static/|favicon|api/auth/|manifest.json).*)'
  ]
} 