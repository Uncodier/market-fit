import 'server-only'
import { configuredApiUrl } from '@/lib/http/api-proxy-security'
import { checkRateLimit, hashRedisKeyPart, rateLimitError } from '@/lib/redis/control-plane'
import { resolvePublicImageResource } from './public-image-resource'
import { readImageResponse, readPromptImageCache, type ImageBytes } from './prompt-image-cache'
import type { PromptImageInput } from './prompt-image-contract'

const inFlight = new Map<string, Promise<ImageBytes | Response>>()
const platforms = new Set(['https://app.makinari.com', 'https://www.makinari.com', 'https://makinari.com'])

function failure(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store, private' } })
}

function publicCommerceRequest(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false
  try {
    const page = new URL(request.headers.get('referer') || '')
    const origin = new URL(request.url).origin
    const allowed = page.origin === origin || (platforms.has(page.origin) && platforms.has(origin))
    const suppliedOrigin = request.headers.get('origin')
    // Native cross-origin images use strict-origin-when-cross-origin by default.
    const commercePair = origin === 'https://app.makinari.com' &&
      ['https://www.makinari.com', 'https://makinari.com'].includes(page.origin)
    return allowed && (!suppliedOrigin || suppliedOrigin === page.origin) &&
      (commercePair || /^\/(shop|marketplace|book|cart)(\/|$)/.test(page.pathname))
  } catch { return false }
}

/** Public misses may generate, but only for server-resolved storefront resources. */
export async function generatePublicImage(request: Request, input: PromptImageInput): Promise<ImageBytes | Response> {
  if (!publicCommerceRequest(request)) return failure('A public commerce page is required', 403)
  const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || 'unknown'
  const clientLimit = await checkRateLimit(`rl:v1:public-image:client:${await hashRedisKeyPart(ip)}`, {
    limit: 300, windowSeconds: 60, failureMode: 'closed',
  })
  if (!clientLimit.allowed) return rateLimitError(clientLimit)
  const canonical = await resolvePublicImageResource(input)
  if (!canonical?.site_id) return failure('Public image resource not found', 404)
  const cached = await readPromptImageCache(canonical, canonical.site_id)
  if (cached) return cached
  const key = `${canonical.site_id}:${canonical.prompt}`
  const existing = inFlight.get(key)
  if (existing) {
    const result = await existing
    return result instanceof Response ? result.clone() : result
  }
  const work = generate(request, canonical)
  inFlight.set(key, work)
  try { return await work } finally { inFlight.delete(key) }
}

async function generate(request: Request, input: PromptImageInput): Promise<ImageBytes | Response> {
  const serviceKey = process.env.SERVICE_API_KEY?.trim()
  const target = configuredApiUrl(request, `/api/public/image/prompt/${encodeURIComponent(input.prompt)}`)
  if (!serviceKey || !target) return failure('Public image generation is not configured', 503)
  for (const [key, limit] of [[`site:${input.site_id}`, 60], ['global', 200]] as const) {
    const admission = await checkRateLimit(`rl:v1:public-image:generation:${key}`, {
      limit, windowSeconds: 3600, failureMode: 'closed',
    })
    if (!admission.allowed) return rateLimitError(admission)
  }
  target.search = new URLSearchParams({ site_id: input.site_id!, width: '1024', height: '1024' }).toString()
  // No fabricated Origin, user identity, browser credentials or arbitrary fetch target.
  const response = await fetch(target, { headers: { 'x-api-key': serviceKey!, Accept: 'image/*' },
    credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(240_000) })
  const image = await readImageResponse(response)
  if (image) return image
  // An uncertain result is not replayed: the upstream workflow may still be running.
  return failure('Image generation could not be confirmed. Try loading the image again later.',
    [400, 401, 402, 403, 409, 429, 503].includes(response.status) ? response.status : 502)
}