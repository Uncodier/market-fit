import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  hostnameFromRequestHeaders,
  resolvePostAuthRedirect,
} from '@/lib/auth/post-auth-redirect'
import { copyResponseCookies, getMiddlewareUser } from '@/lib/supabase/middleware-client'
import { resolveBlockedScreenRedirect } from '@/lib/auth/enforce-screen-access'
import { shouldClearDemoCookieOnPath } from '@/lib/auth/workspace-site-redirect'
import { isRouterPrefetchRequest } from '@/lib/navigation/is-router-prefetch'
import { isServerActionRequest } from '@/lib/navigation/is-server-action'

// Lista específica y exacta de rutas públicas permitidas
const ALLOWED_PUBLIC_PATHS = [
  '/auth',
  '/auth/callback',
  '/auth/logout',
  '/demo',
  '/book',
  '/shop',
  '/marketplace',
  '/cart',
]

/** Guest document share links — require `/prefix/` so `/q` does not match `/quotations`. */
function isPublicDocumentSharePath(pathname: string): boolean {
  return (
    pathname.startsWith('/q/') ||
    pathname.startsWith('/i/') ||
    pathname.startsWith('/so/') ||
    pathname.startsWith('/vb/')
  )
}

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
function forbiddenResponse(request?: NextRequest): NextResponse {
  const response = new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
    headers: { 'content-type': 'application/json' }
  })
  return getCorsHeaders(response, request)
}

// Rutas que deben ser excluidas del middleware completamente
const EXCLUDED_PATHS = [
  '/api/auth/logout'
]

// Map of common aliases that agents might use, mapping to the actual path
const ALIAS_MAP: Record<string, string> = {
  'instance': 'robots',
  'instances': 'robots',
  'chats': 'chat',
  'messages': 'chat',
  'conversations': 'chat',
  'collection': 'content',
  'collections': 'content',
  'items': 'content',
  'campaign': 'campaigns',
  'deal': 'deals',
  'lead': 'leads',
  'person': 'people',
  'company': 'companies',
  'task': 'tasks',
  'segment': 'segments',
  'asset': 'assets'
}

function isAllowedCorsOrigin(origin: string | null): origin is string {
  if (!origin) return false
  if (
    origin === 'https://www.makinari.com' ||
    origin === 'https://makinari.com' ||
    origin === 'https://app.makinari.com' ||
    origin === 'https://demo.makinari.com'
  ) {
    return true
  }
  if (origin.endsWith('.makinari.com') || origin.endsWith('.uncodie.com') || origin.endsWith('.aimarket.fit')) {
    return true
  }
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    return true
  }
  // Local LAN dev hosts
  if (/^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin)) {
    return true
  }
  return false
}

function isTrustedActionOriginHost(host: string): boolean {
  return (
    host === 'makinari.com' ||
    host.endsWith('.makinari.com') ||
    host.endsWith('.uncodie.com') ||
    host.endsWith('.aimarket.fit') ||
    host.startsWith('localhost:') ||
    host.startsWith('127.0.0.1:') ||
    /^192\.168\.\d+\.\d+(:\d+)?$/.test(host)
  )
}

/**
 * www → app proxy sets x-forwarded-host=app while the browser Origin is www.
 * Next aborts Server Actions on that mismatch (E80). Align forwarded host to
 * the trusted Origin host so CSRF checks pass for proxied commerce pages.
 */
function nextWithAlignedServerActionHost(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers)
  const actionId = request.headers.get('next-action')
  const origin = request.headers.get('origin')

  if (actionId && origin && origin !== 'null') {
    try {
      const originHost = new URL(origin).host
      const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
      if (
        isTrustedActionOriginHost(originHost) &&
        forwardedHost &&
        forwardedHost !== originHost
      ) {
        headers.set('x-forwarded-host', originHost)
      }
    } catch {
      // keep original headers
    }
  }

  return NextResponse.next({ request: { headers } })
}

// CORS headers configuration
const getCorsHeaders = (
  response: NextResponse,
  request?: NextRequest,
  isPublicBooking = false
) => {
  const origin = request?.headers.get('origin') ?? null

  // Never combine Access-Control-Allow-Origin: * with Allow-Credentials: true (Safari rejects it).
  if (isAllowedCorsOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.append('Vary', 'Origin')
  } else if (!origin) {
    // Same-origin navigations / server-to-server: no ACAO needed
  } else {
    // Unknown cross-origin callers: allow non-credentialed reads for public APIs
    response.headers.set('Access-Control-Allow-Origin', '*')
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-api-secret, x-client-info, apikey, x-supabase-api-version');
  response.headers.set('Access-Control-Max-Age', '86400'); // 24 horas
  
  // Include https://app.makinari.com so commerce pages proxied under www can load assetPrefix chunks.
  let csp = "default-src 'self'; connect-src 'self' https://app.makinari.com https://www.makinari.com https://*.supabase.co wss://*.supabase.co https://*.supabase.in http://localhost:3001 http://192.168.0.38:3001 http://192.168.87.79:3001 http://192.168.87.25:3001 http://192.168.87.246:3001 http://192.168.87.34:* http://192.168.87.34 https://192.168.87.34:* http://192.168.87.49/* http://192.168.87.49:* https://192.168.87.49/* https://192.168.87.49:* http://192.168.87.174:* http://192.168.87.174 https://192.168.87.174:* http://192.168.87.180:* http://192.168.87.180 https://192.168.87.180:* https://tu-api-real.com https://api.market-fit.ai https://backend.aimarket.fit https://backend.uncodie.com https://api.uncodie.com https://backend.makinari.com https://db.makinari.com wss://db.makinari.com https://ipapi.co https://nominatim.openstreetmap.org https://api.stripe.com https://*.stripe.com; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://files.uncodie.com https://backend.uncodie.com https://app.makinari.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://app.makinari.com; img-src 'self' data: blob: https: http://localhost:3001; font-src 'self' data: https://fonts.gstatic.com https://app.makinari.com; media-src 'self' blob: https://files.uncodie.com https://*.supabase.co https://rnjgeloamtszdjplmqxy.supabase.co https://db.makinari.com; frame-src 'self' https://*.vercel.app https://*.supabase.co https://rnjgeloamtszdjplmqxy.supabase.co https://docs.google.com https://js.stripe.com https://hooks.stripe.com https://*.stripe.com https://*.scrapybara.com https://*.makinari.com https://*.preview.makinari.com https://www.openstreetmap.org;";
  
  if (isPublicBooking) {
    csp += " frame-ancestors *;";
    // Remove X-Frame-Options if it was set to DENY/SAMEORIGIN
    response.headers.delete('X-Frame-Options');
  }
  
  response.headers.set('Content-Security-Policy', csp);
  return response;
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublicBooking = pathname.startsWith('/book')
  
  // Block suspicious requests immediately
  if (isSuspiciousRequest(pathname)) {
    // Avoid logging as error to keep console clean
    return new NextResponse(null, { status: 404 })
  }
  
  // Handle route aliases for agent-generated URLs
  // Patterns: /site/[siteId]/[alias](/[id])? OR /[alias](/[id])?
  let targetAlias = null;
  let targetId = null;
  let isAliasMatch = false;
  
  // Check for /site/xxxxx/alias/id pattern
  const sitePatternMatch = pathname.match(/^\/site\/[^\/]+\/([^\/]+)(?:\/(.*))?$/);
  if (sitePatternMatch) {
    targetAlias = sitePatternMatch[1];
    targetId = sitePatternMatch[2];
    isAliasMatch = true;
  } else {
    // Check for /alias/id pattern (only if it's in our alias map to avoid intercepting actual routes)
    const directPatternMatch = pathname.match(/^\/([^\/]+)(?:\/(.*))?$/);
    if (directPatternMatch) {
      const potentialAlias = directPatternMatch[1];
      if (ALIAS_MAP[potentialAlias] || potentialAlias === 'chat' || potentialAlias === 'robots') {
        // If it's a known alias, OR if it's already the target collection but has an ID (needs query param conversion)
        targetAlias = potentialAlias;
        targetId = directPatternMatch[2];
        isAliasMatch = true;
      }
    }
  }

  if (isAliasMatch && targetAlias) {
    const mappedCollection = ALIAS_MAP[targetAlias] || targetAlias; // Fallback to targetAlias if it's already the right collection (e.g. they used 'chat/123')
    
    let redirectUrl = null;
    const url = request.nextUrl.clone();
    
    // Handle special cases that need query parameters
    if (mappedCollection === 'chat' && targetId) {
      url.pathname = '/chat';
      url.searchParams.set('conversationId', targetId);
      redirectUrl = url;
    } else if (mappedCollection === 'robots' && targetId) {
      url.pathname = '/robots';
      url.searchParams.set('instance', targetId);
      redirectUrl = url;
    } else if (mappedCollection !== targetAlias || sitePatternMatch) {
      // General case: rewrite to canonical path
      url.pathname = targetId ? `/${mappedCollection}/${targetId}` : `/${mappedCollection}`;
      // Keep existing search params
      redirectUrl = url;
    }
    
    if (redirectUrl) {
      return NextResponse.redirect(redirectUrl);
    }
  }
  
  // Handle OPTIONS request for preflight checks (CORS)
  if (request.method === 'OPTIONS') {
    return getCorsHeaders(new NextResponse(null, { status: 204 }), request, isPublicBooking);
  }
  
  // NUNCA procesar recursos estáticos - siempre permitir acceso
  if (isStaticOrResourceFile(pathname)) {
    return NextResponse.next()
  }
  
  // Excluir rutas específicas del middleware completamente
  if (EXCLUDED_PATHS.some(path => pathname === path || pathname.startsWith(path))) {
    return nextWithAlignedServerActionHost(request)
  }
  
  // Skip Supabase auth for ALL /api/* routes - they do their own session checks.
  // This prevents ECONNRESET in dev: each middleware run was doing getUser+getSession
  // against Supabase; with many parallel fetches (layout, RSC, etc.) the connection
  // pool gets exhausted and connections go stale.
  if (pathname.startsWith('/api/')) {
    const res = nextWithAlignedServerActionHost(request)
    return getCorsHeaders(res, request, isPublicBooking)
  }
  
  // Redirigir /auth/login a /auth para mantener una única ruta de autenticación
  if (pathname === '/auth/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    url.search = request.nextUrl.search // Mantener los query params
    return NextResponse.redirect(url)
  }

  const isAuthPath = pathname === '/auth' || pathname === '/auth/'
  const isPublicPage =
    pathname === '/' ||
    ALLOWED_PUBLIC_PATHS.some(path => pathname.startsWith(path)) ||
    isPublicDocumentSharePath(pathname)

  const sessionResponse = nextWithAlignedServerActionHost(request)
  getCorsHeaders(sessionResponse, request, isPublicBooking)

  const isPrefetch = isRouterPrefetchRequest(request.headers)
  const isServerAction = isServerActionRequest(request.headers)
  let middlewareUserId: string | null = null

  if (isAuthPath || !isPublicPage) {
    const { user, lookupFailed } = await getMiddlewareUser(request, sessionResponse)
    middlewareUserId = user?.id ?? null

    if (isAuthPath) {
      if (user && !isPrefetch) {
        const destination = resolvePostAuthRedirect(
          request.nextUrl.searchParams.get('returnTo'),
          hostnameFromRequestHeaders(request.headers)
        )
        return copyResponseCookies(
          sessionResponse,
          NextResponse.redirect(new URL(destination, request.url))
        )
      }
    } else if (!user && !lookupFailed && !request.cookies.has('market_fit_demo_site_id')) {
      if (isApiLikeRequest(request)) {
        return forbiddenResponse(request)
      }
      if (!isPrefetch) {
        const url = request.nextUrl.clone()
        url.pathname = '/auth'
        url.search = `?returnTo=${encodeURIComponent(pathname)}`
        return copyResponseCookies(sessionResponse, NextResponse.redirect(url))
      }
    }
  }

  if (
    middlewareUserId &&
    !isPublicPage &&
    !isAuthPath &&
    !isPrefetch &&
    !isServerAction &&
    !request.cookies.has('market_fit_demo_site_id')
  ) {
    try {
      const blockedRedirect = await resolveBlockedScreenRedirect(
        request,
        sessionResponse,
        middlewareUserId
      )
      if (blockedRedirect) {
        return copyResponseCookies(sessionResponse, blockedRedirect)
      }
    } catch {
      // Fail open on lookup errors so a membership query cannot take down the app.
    }
  }

  // Recreate the forwarded request so RSC sees refreshed or cleared cookies.
  const res = nextWithAlignedServerActionHost(request)
  copyResponseCookies(sessionResponse, res)
  getCorsHeaders(res, request, isPublicBooking)

  if (shouldClearDemoCookieOnPath(pathname) && request.cookies.has('market_fit_demo_site_id')) {
    res.cookies.set('market_fit_demo_site_id', '', {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    })
  }

  return res
}

// Configuración que excluye explícitamente recursos estáticos y rutas de API
export const config = {
  matcher: [
    // Excluir explícitamente recursos estáticos, archivos SEO y API routes específicas
    '/((?!_next/|static/|favicon|manifest.json|robots.txt|sitemap.xml|apple-touch-icon.png|browserconfig.xml|api/auth/logout).*)'
  ]
} 