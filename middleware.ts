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
  '/segments',
  '/campaigns',
  '/leads',
  '/sales',
  '/agents',
  '/control-center',
  '/content',
  '/billing',
  '/checkout',
  '/requirements',
  '/notifications',
  '/costs'
]

// Define las rutas de autenticación
const AUTH_ROUTES = ['/auth']

// Define API routes that need special cookie handling for authentication
const API_AUTH_ROUTES = [
  '/api/secure-tokens'
]

// /api/social/*: do not run Supabase in the middleware. Running getUser/getSession here
// can clear the session cookie on failure (refresh, edge). That would log the user out
// when they: 1) hit auth-url before redirecting to Outstand, 2) hit the callback on return.
// The routes (auth-url, callback, pending, finalize) do their own auth or redirect; we
// avoid any cookie write in the middleware for this subtree.
const API_SOCIAL_SKIP_SUPABASE = ['/api/social']

// /settings/social_network: OAuth return page. We saw the first GET has session, then a
// second GET (RSC/prefetch/useSearchParams) has no session — something in the first
// response clears the cookie. createServerClient's getUser/getSession can trigger set/remove.
// We skip Supabase here entirely: no cookie read/write, no redirect to /auth. The page
// loads; client-side auth or /settings (on "Back to Settings") will enforce login.
const PAGE_SOCIAL_NETWORK_SKIP_SUPABASE = '/settings/social_network'

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

// IMPORTANTE: Excluir completamente recursos estáticos y archivos SEO
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

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  
  // Block suspicious requests immediately
  if (isSuspiciousRequest(path)) {
    console.log('Middleware: Blocked suspicious request:', path)
    return new NextResponse(null, { status: 404 })
  }

  // NUNCA procesar recursos estáticos - siempre permitir acceso
  if (isStaticOrResourceFile(path)) {
    return NextResponse.next()
  }

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
    
    // Special handling for API auth routes
    const isApiAuthRoute = API_AUTH_ROUTES.some(route => path.startsWith(route))
    if (isApiAuthRoute) {
      console.log('Middleware: API route detected:', path);
      
      // For secure token APIs, simply pass through the request without
      // modifying any cookies or headers to avoid parsing issues
      return NextResponse.next();
    }

    const isApiSocial = API_SOCIAL_SKIP_SUPABASE.some(route => path.startsWith(route))
    if (isApiSocial) {
      return NextResponse.next()
    }

    if (path.startsWith(PAGE_SOCIAL_NETWORK_SKIP_SUPABASE)) {
      const authNames = req.cookies.getAll().filter((c) => c.name.startsWith("sb-")).map((c) => c.name)
      // Chunked: sb-*-auth-token.0, .1 — use includes()
      console.log("[Social /settings/social_network] skip Supabase, hasAuth:", authNames.some((n) => n.includes("-auth-token")), "cookieNames:", authNames.length ? authNames : "none")
      return NextResponse.next()
    }
    
    // Create Supabase client. We NEVER clear the session from the middleware: when
    // getUser/refresh fails (e.g. right after OAuth return, /api/notifications from
    // the layout, etc.) Supabase would call set('') or remove() and we'd lose the
    // user. Only explicit logout (/api/auth/logout, etc.) should clear; those use
    // their own createClient. So we no-op any write that would clear.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return req.cookies.get(name)?.value
          },
          set(name, value, options) {
            if (value === '' || value == null || (options && (options as { maxAge?: number }).maxAge === 0)) return
            res.cookies.set(name, value, {
              ...options,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production'
            })
          },
          remove(_name: string, _opts?: { path?: string }) {
            // No-op: never clear session from middleware (fixes loss after OAuth return
            // when /api/notifications or other layout fetches run Supabase and it fails).
          }
        }
      }
    )
    
    // Verificar la sesión usando getUser(); si falla, usaremos la sesión del cookie
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError) {
      console.error('Middleware auth error:', userError.message)
    }

    // También obtener la sesión (no requiere fetch externo)
    const { data: { session } } = await supabase.auth.getSession()

    // Fallback: si getUser falló (edge fetch), usa el usuario de la sesión
    const effectiveUser = user ?? session?.user ?? null

    console.log('Middleware check:', {
      path,
      hasSession: !!session,
      hasUser: !!effectiveUser,
      userId: effectiveUser?.id?.substring(0, 8) + '...' || 'undefined...'
    })

    // Obtener la ruta actual
    // Si es una ruta de autenticación
    if (path.startsWith('/auth')) {
      // Permitir acceso a rutas específicas de auth sin redirección
      // These pages need to allow authenticated users during password reset flow
      const authFlowPages = [
        '/auth/confirm',
        '/auth/callback',
        '/auth/set-password',
        '/auth/reset-password',
        '/auth/team-invitation'
      ]
      
      if (authFlowPages.includes(path)) {
        console.log('Middleware: Allowing access to auth flow page:', path)
        // Always allow these pages, even for authenticated users
        // This is critical for password reset flow where user is authenticated but needs to set password
        return res
      }
      
      // Si el usuario está autenticado y no está en una página de flujo de auth, redirigir al dashboard o returnTo
      if (effectiveUser) {
        const returnTo = req.nextUrl.searchParams.get('returnTo') || '/dashboard'
        console.log('Middleware: Authenticated user on auth page, redirecting to:', returnTo)
        const redirectUrl = new URL(returnTo, req.url)
        return NextResponse.redirect(redirectUrl)
      }
      // Si no está autenticado, permitir acceso a la página de auth principal
      return res
    }

    // Si es una ruta protegida
    if (PROTECTED_ROUTES.some(route => path.startsWith(route))) {
      // Si no hay usuario autenticado, redirigir a auth con returnTo
      if (!effectiveUser) {
        console.log('Middleware: Protected route without session, redirecting to auth. Path:', path)
        const redirectUrl = new URL('/auth', req.url)
        redirectUrl.searchParams.set('returnTo', path)
        return NextResponse.redirect(redirectUrl)
      } else {
        console.log('Middleware: Protected route with valid session, allowing access. Path:', path)
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
     * - SEO files (robots.txt, sitemap.xml, etc.)
     * - api (API routes)
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json|apple-touch-icon.png|browserconfig.xml|public).*)',
  ],
} 