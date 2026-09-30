import { z } from 'zod'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from '@/lib/http/read-limited-request-body'

const uuid = z.string().uuid()
const allowedCategories = new Set([
  'industries', 'organizations', 'organization_keywords', 'locations', 'person_skills', 'web_technologies',
])
const MAX_BODY_BYTES = 128_000
const MAX_RESPONSE_BYTES = 5_000_000

function error(message: string, status: number) {
  return Response.json({ success: false, error: { message } }, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  })
}

function backendUrl(request: Request): URL | null {
  const configured = (process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_SERVER_URL || '').trim()
  const base = /^https?:\/\//i.test(configured) ? configured
    : `${/^(localhost|127\.0\.0\.1)(:|$)/i.test(configured) ? 'http' : 'https'}://${configured}`
  try {
    const url = new URL(base)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (!configured || url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && local && process.env.NODE_ENV !== 'production')) ||
      url.origin === new URL(request.url).origin) return null
    return url
  } catch {
    return null
  }
}

function singleParam(params: URLSearchParams, name: string): string | null {
  const values = params.getAll(name)
  return values.length === 1 ? values[0] : null
}

export async function proxyFinderRequest(request: Request, path: string[]): Promise<Response> {
  const route = path.join('/')
  const isAutocomplete = path.length === 2 && path[0] === 'autocomplete' && allowedCategories.has(path[1])
  const validMethod = (route === 'icp' && ['GET', 'DELETE'].includes(request.method)) ||
    (isAutocomplete && request.method === 'GET') ||
    (['person_role_search', 'person_role_search/totals', 'person_role_search/createQuery'].includes(route) && request.method === 'POST')
  if (!validMethod) return error('Finder endpoint not found', 404)

  const url = new URL(request.url)
  const origin = request.headers.get('origin')
  if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    return error('Origin not allowed', 403)
  }

  let siteId: string | null = null
  let body: Uint8Array | undefined
  const query = new URLSearchParams()
  if (request.method === 'POST') {
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
      return error('JSON content type required', 415)
    }
    try {
      body = await readLimitedRequestBody(request, MAX_BODY_BYTES)
      const input: unknown = JSON.parse(decodeRequestBody(body))
      if (!input || typeof input !== 'object' || Array.isArray(input)) return error('Invalid Finder request', 400)
      siteId = (input as Record<string, unknown>).site_id as string
    } catch (cause) {
      return error('Invalid Finder request', cause instanceof RequestBodyTooLargeError ? 413 : 400)
    }
  } else {
    siteId = singleParam(url.searchParams, 'site_id')
    if (route === 'icp') {
      const icpId = singleParam(url.searchParams, 'icp_id')
      if (!uuid.safeParse(icpId).success) return error('Invalid saved list ID', 400)
      query.set('icp_id', icpId!)
    } else {
      const term = singleParam(url.searchParams, 'q')
      const page = singleParam(url.searchParams, 'page')
      if (term === null || term.length > 200 || !page || !/^(0|[1-9]\d{0,3})$/.test(page)) {
        return error('Invalid lookup request', 400)
      }
      query.set('q', term)
      query.set('page', page)
    }
  }
  if (!uuid.safeParse(siteId).success) return error('Invalid site ID', 400)
  query.set('site_id', siteId!)

  const access = await requireSiteAccess(request, siteId!)
  if (access.error) return access.error
  const { data: { session }, error: sessionError } = await access.supabase.auth.getSession()
  if (sessionError || !session?.access_token || session.user?.id !== access.userId) {
    return error('Please sign in again to use Find People.', 401)
  }

  const base = backendUrl(request)
  if (!base) return error('Finder API is not configured', 503)
  const target = new URL(`/api/finder/${route}`, base)
  if (request.method !== 'POST') target.search = query.toString()

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: { Authorization: `Bearer ${session.access_token}`, Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: decodeRequestBody(body) } : {}),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    })
    if (upstream.status === 204) {
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store, private' } })
    }
    if (!upstream.headers.get('content-type')?.includes('application/json')) {
      await upstream.body?.cancel()
      return error('Finder API returned an invalid response', 502)
    }
    const responseBody = await readLimitedRequestBody(upstream as unknown as Request, MAX_RESPONSE_BYTES)
    if (!upstream.ok) {
      const status = [400, 401, 403, 404, 409, 429].includes(upstream.status) ? upstream.status : 502
      return error(status === 401 ? 'Please sign in again to use Find People.' :
        status === 403 ? 'You do not have access to this site.' :
          status === 404 ? 'Saved list not found.' : 'Finder API request failed', status)
    }
    try {
      JSON.parse(decodeRequestBody(responseBody))
    } catch {
      return error('Finder API returned an invalid response', 502)
    }
    return new Response(decodeRequestBody(responseBody), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, private' },
    })
  } catch {
    return error('Finder API is unavailable', 502)
  }
}