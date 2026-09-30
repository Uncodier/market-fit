import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { readCurrentSiteIdFromCookieHeader } from '@/lib/auth/current-site-cookie'
import { isSameOriginApiRequest, configuredApiUrl } from '@/lib/http/api-proxy-security'
import { userCanOnSite } from '@/lib/permissions/site-access'
import { parsePromptImageInput } from '@/lib/images/prompt-image-contract'
import { readImageResponse, readPromptImageCache, type ImageBytes } from '@/lib/images/prompt-image-cache'
import { IMAGE_PLACEHOLDER_SVG } from '@/app/lib/image-placeholder'

export const maxDuration = 120

function placeholder() {
  return new Response(IMAGE_PLACEHOLDER_SVG, { headers: {
    'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store, private', 'X-Image-Delivery': 'placeholder',
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  } })
}

function image(result: ImageBytes) {
  return new Response(result.bytes as BodyInit, { headers: {
    'Content-Type': result.contentType, 'Cache-Control': 'private, max-age=300',
    Vary: 'Cookie',
    'X-Content-Type-Options': 'nosniff', 'X-Image-Delivery': 'cached-or-generated',
  } })
}

function failure(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store, private' } })
}

function mayGenerate(request: Request): boolean {
  if (!isSameOriginApiRequest(request) || request.headers.get('sec-fetch-site') === 'same-site') return false
  if (request.headers.get('sec-fetch-site') === 'same-origin' || request.headers.has('origin')) return true
  try {
    return new URL(request.headers.get('referer') || '').origin === new URL(request.url).origin
  } catch {
    return false
  }
}

export async function GET(request: Request): Promise<Response> {
  const input = parsePromptImageInput(new URL(request.url).searchParams)
  if (!input) return failure('Invalid image request', 400)
  try {
    const cookieSite = readCurrentSiteIdFromCookieHeader(request.headers.get('cookie'))
    const siteId = input.site_id || (cookieSite && !cookieSite.startsWith('demo-') ? cookieSite : null)
    // Public delivery never starts a workflow. Reading this public bucket needs no credentials.
    const cached = await readPromptImageCache(input, siteId)
    if (cached) return image(cached)
    const hasSession = Boolean(request.headers.get('cookie') || request.headers.get('authorization'))
    if (!siteId || input.cache_only || !hasSession) return placeholder()
    if (!mayGenerate(request)) {
      return failure('Origin not allowed', 403)
    }
    const access = await requireSiteAccess(request, siteId)
    if (access.error) {
      // Anonymous shoppers may have unrelated commerce cookies, but no workspace session.
      return access.error.status === 401 ? placeholder() : access.error
    }
    if (!await userCanOnSite(access.supabase, siteId, 'insert')) return failure('Image generation is not permitted.', 403)
    const { data: { session }, error } = await access.supabase.auth.getSession()
    if (error || !session?.access_token || session.user?.id !== access.userId) return failure('Please sign in again to generate images.', 401)
    const target = configuredApiUrl(request, `/api/public/image/prompt/${encodeURIComponent(input.prompt)}`)
    if (!target) return failure('Image generation API is not configured', 503)
    target.search = new URLSearchParams({ site_id: siteId, width: String(input.width), height: String(input.height) }).toString()
    const response = await fetch(target, {
      headers: { Authorization: `Bearer ${session.access_token}`, Accept: 'image/*' },
      credentials: 'omit', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(110_000)]),
    })
    const result = await readImageResponse(response)
    if (result) return image(result)
    const status = [400, 401, 403, 409, 429, 503].includes(response.status) ? response.status : 502
    return failure('Image generation could not be confirmed. Try loading the image again later.', status)
  } catch {
    // Do not replay a request that may have started paid generation.
    return failure('Image delivery is temporarily unavailable.', 502)
  }
}