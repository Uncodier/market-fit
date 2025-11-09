import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Lista específica y exacta de rutas públicas permitidas
const ALLOWED_PUBLIC_PATHS = [
  '/auth',
  '/auth/callback',
  '/auth/logout'
]

// Define suspicious patterns that should be blocked immediately
const SUSPICIOUS_PATTERNS = [
  /\.php(\?|$)/i,
  /\/wp-/i,
  /\/admin/i,
  /\/backend/i,
  /\/scripts/i,
  /\/server\/php/i,
  /filemanager/i,
  /upload/i,
  /\.asp(\?|$)/i,
  /\.jsp(\?|$)/i,
  /\.cgi(\?|$)/i,
  /\/cgi-bin/i,
  /\/xmlrpc/i,
  /\/phpmyadmin/i,
  /\/mysql/i,
  /\.env/i,
  /\.git/i,
  /\.sql/i,
  /\/config\./i,
  /\/setup/i,
  /\/install/i
]

// Define known malicious file extensions and paths
const MALICIOUS_EXTENSIONS = [
  '.php', '.asp', '.aspx', '.jsp', '.cgi', '.pl', '.py', '.rb', '.sh'
]

function isSuspiciousRequest(path: string): boolean {
  // Check for suspicious patterns
  if (SUSPICIOUS_PATTERNS.some(pattern => pattern.test(path))) {
    return true
  }
  
  // Check for malicious extensions in non-API routes
  if (!path.startsWith('/api/') && MALICIOUS_EXTENSIONS.some(ext => path.includes(ext))) {
    return true
  }
  
  // Check for directory traversal attempts
  if (path.includes('..') || path.includes('%2e%2e')) {
    return true
  }
  
  return false
}

// IMPORTANTE: Excluir completamente recursos estáticos
function isStaticOrResourceFile(pathname: string): boolean {
  // SEO and standard web files that should be publicly accessible
  const publicFiles = [
    '/robots.txt',
    '/sitemap.xml',
    '/favicon.ico',
    '/manifest.json',
    '/apple-touch-icon.png',
    '/browserconfig.xml'
  ];
  
  if (publicFiles.includes(pathname)) {
    return true;
  }
  
  return pathname.includes('/_next/') || 
         pathname.includes('/static/') ||
         pathname.startsWith('/__next') ||
         pathname.startsWith('/favicon') ||
         /\.[a-z0-9]+$/i.test(pathname) // Cualquier archivo con extensión
}

// Detect if request is for API or expects JSON
function isApiLikeRequest(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname
  const accept = request.headers.get('accept') || ''
  const requestedWith = request.headers.get('x-requested-with') || ''
  return pathname.startsWith('/api') || accept.includes('application/json') || requestedWith === 'XMLHttpRequest'
}

// Create a standard 403 Forbidden response with proper headers
function forbiddenResponse(): NextResponse {
  const response = new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
    headers: { 'content-type': 'application/json' }
  })
  return getCorsHeaders(response)
}

// Rutas que deben ser excluidas del middleware completamente
const EXCLUDED_PATHS = [
  '/api/auth/logout'
]

// CORS headers configuration
const getCorsHeaders = (response: NextResponse) => {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-api-secret');
  response.headers.set('Access-Control-Max-Age', '86400'); // 24 horas
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Content-Security-Policy', "default-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in http://localhost:3001 http://192.168.0.38:3001 http://192.168.87.79:3001 http://192.168.87.25:3001 http://192.168.87.246:3001 http://192.168.87.34:* http://192.168.87.34 https://192.168.87.34:* http://192.168.87.49/* http://192.168.87.49:* https://192.168.87.49/* https://192.168.87.49:* http://192.168.87.174:* http://192.168.87.174 https://192.168.87.174:* http://192.168.87.180:* http://192.168.87.180 https://192.168.87.180:* https://tu-api-real.com https://api.market-fit.ai https://backend.makinari.com https://db.makinari.com wss://db.makinari.com; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;");
  return response;
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Block suspicious requests immediately
  if (isSuspiciousRequest(pathname)) {
    // Avoid logging as error to keep console clean
    return new NextResponse(null, { status: 404 })
  }
  
  // Handle OPTIONS request for preflight checks (CORS)
  if (request.method === 'OPTIONS') {
    return getCorsHeaders(new NextResponse(null, { status: 204 }));
  }
  
  // NUNCA procesar recursos estáticos - siempre permitir acceso
  if (isStaticOrResourceFile(pathname)) {
    return NextResponse.next()
  }
  
  // Excluir rutas específicas del middleware completamente
  if (EXCLUDED_PATHS.some(path => pathname === path || pathname.startsWith(path))) {
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
    return getCorsHeaders(NextResponse.next());
  }
  
  try {
    // Crear el cliente de Supabase
    const res = NextResponse.next()
    
    // Add CORS headers
    getCorsHeaders(res);
    
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
      // API-like requests get 403 to avoid client-side errors
      if (isApiLikeRequest(request)) {
        return forbiddenResponse()
      }
      // Si no hay sesión en rutas de páginas, redirigir a login
      const url = request.nextUrl.clone()
      url.pathname = '/auth'
      url.search = `?returnTo=${encodeURIComponent(pathname)}`
      return NextResponse.redirect(url)
    }

    // Usuario autenticado: permitir acceso
    return res
  } catch (error) {
    // Avoid console.error noise; respond appropriately
    if (isApiLikeRequest(request)) {
      return forbiddenResponse()
    }
    // En caso de error en rutas de páginas, redirigir a login
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    url.search = `?returnTo=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(url)
  }
}

// Configuración que excluye explícitamente recursos estáticos y rutas de API
export const config = {
  matcher: [
    // Excluir explícitamente recursos estáticos, archivos SEO y API routes específicas
    '/((?!_next/|static/|favicon|manifest.json|robots.txt|sitemap.xml|apple-touch-icon.png|browserconfig.xml|api/auth/logout).*)'
  ]
} 