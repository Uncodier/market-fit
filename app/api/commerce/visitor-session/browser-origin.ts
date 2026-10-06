import { isSameOriginApiRequest } from '@/lib/http/api-proxy-security'

const platformOrigins = new Set(['https://app.makinari.com', 'https://www.makinari.com', 'https://makinari.com'])
const commerceOrigins = new Set(['https://www.makinari.com', 'https://makinari.com'])

export function trustedVisitorBrowserOrigin(request: Request): string | null {
  const origin = request.headers.get('origin')
  if (!origin || request.headers.get('sec-fetch-site') === 'cross-site') return null
  if (isSameOriginApiRequest(request)) return origin
  // These exact platform pairs support www rewrites and same-site direct app delivery.
  return platformOrigins.has(origin) && platformOrigins.has(new URL(request.url).origin) ? origin : null
}

function directCommerceOrigin(request: Request): string | null {
  const origin = trustedVisitorBrowserOrigin(request)
  return origin && commerceOrigins.has(origin) && new URL(request.url).origin === 'https://app.makinari.com'
    ? origin : null
}

export function withVisitorSessionCors(request: Request, response: Response): Response {
  const origin = directCommerceOrigin(request)
  if (origin) {
    // Anonymous issuance never uses cookies, user bearer tokens, or wildcard CORS.
    response.headers.set('Access-Control-Allow-Origin', origin)
    const vary = response.headers.get('Vary')?.split(',').map(value => value.trim()) || []
    if (!vary.some(value => value.toLowerCase() === 'origin')) vary.push('Origin')
    response.headers.set('Vary', vary.join(', '))
  }
  return response
}

export function visitorSessionPreflight(request: Request): Response {
  const headers = request.headers.get('access-control-request-headers')?.split(',')
    .map(value => value.trim().toLowerCase()).filter(Boolean) || []
  if (!directCommerceOrigin(request) || request.headers.get('access-control-request-method') !== 'POST'
    || headers.some(header => header !== 'content-type')) {
    return new Response(null, { status: 403, headers: { 'Cache-Control': 'no-store, private', Vary: 'Origin' } })
  }
  return withVisitorSessionCors(request, new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store, private', Vary: 'Origin',
  } }))
}