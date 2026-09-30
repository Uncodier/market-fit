import { z } from 'zod'
import { getShopSite } from '@/app/shop/[siteSlug]/actions'
import { configuredApiUrl, isSameOriginApiRequest } from '@/lib/http/api-proxy-security'
import { readLimitedRequestBody, decodeRequestBody, RequestBodyTooLargeError } from '@/lib/http/read-limited-request-body'
import { checkRateLimit, hashRedisKeyPart, rateLimitError } from '@/lib/redis/control-plane'

export const maxDuration = 30

const inputSchema = z.object({
  site_id: z.string().uuid(),
  url: z.string().url().max(2048),
  referrer: z.string().url().max(2048).optional(),
}).strict()
const sessionSchema = z.object({
  success: z.literal(true),
  data: z.object({
    site_id: z.string().uuid(), visitor_id: z.string().uuid(), session_id: z.string().uuid(),
    session_token: z.string().min(1).max(8192), expires_at: z.number().int().positive(), ttl: z.number().int().positive(),
  }),
})
const platformOrigins = new Set(['https://app.makinari.com', 'https://www.makinari.com', 'https://makinari.com'])

function failure(message: string, status: number) {
  return Response.json({ success: false, error: { message } }, {
    status, headers: { 'Cache-Control': 'no-store, private', Vary: 'Origin' },
  })
}

function trustedBrowserOrigin(request: Request): string | null {
  const origin = request.headers.get('origin')
  if (!origin || request.headers.get('sec-fetch-site') === 'cross-site') return null
  if (isSameOriginApiRequest(request)) return origin
  // The www deployment rewrites this exact endpoint to app; these are configured platform hosts.
  return platformOrigins.has(origin) && platformOrigins.has(new URL(request.url).origin) ? origin : null
}

export async function POST(request: Request): Promise<Response> {
  const origin = trustedBrowserOrigin(request)
  if (!origin) return failure('Origin not allowed', 403)
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return failure('JSON content type required', 415)
  let input: z.infer<typeof inputSchema>
  try {
    input = inputSchema.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 8_192))))
    const page = new URL(input.url)
    if (page.origin !== origin || page.username || page.password ||
      !/^\/(shop(?:\/|$)|marketplace(?:\/|$)|cart\/checkout(?:\/|$))/.test(page.pathname)) {
      return failure('A public commerce page is required', 400)
    }
    // URLs are attribution data, never fetch targets. Do not persist checkout tokens/fragments.
    input.url = `${page.origin}${page.pathname}`
    if (input.referrer) {
      const referrer = new URL(input.referrer)
      if (!['http:', 'https:'].includes(referrer.protocol) || referrer.username || referrer.password) return failure('Invalid referrer', 400)
      input.referrer = `${referrer.origin}${referrer.pathname}`
    }
  } catch (error) {
    return failure('Invalid visitor session request', error instanceof RequestBodyTooLargeError ? 413 : 400)
  }

  try {
    // Public issuance is intentionally narrow and rate-limited before database/provider access.
    const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip')?.trim() || 'unknown'
    const limit = await checkRateLimit(`rl:v1:commerce-visitor:${await hashRedisKeyPart(ip)}`, {
      limit: 20, windowSeconds: 60, failureMode: 'closed',
    })
    if (!limit.allowed) return rateLimitError(limit)
    const global = await checkRateLimit('rl:v1:commerce-visitor:global', { limit: 500, windowSeconds: 60, failureMode: 'closed' })
    if (!global.allowed) return rateLimitError(global)

    // This is the same public, non-archived site boundary used to render /shop/[siteSlug].
    const site = await getShopSite(input.site_id)
    if (!site || site.id !== input.site_id) return failure('Public site not found', 404)
    const target = configuredApiUrl(request, '/api/visitors/session')
    const serviceKey = process.env.SERVICE_API_KEY?.trim()
    if (!target || !serviceKey) return failure('Visitor session service is not configured', 503)
    const upstream = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-api-key': serviceKey },
      // Always mint a new anonymous visitor. Never accept an existing visitor, actor or session ID.
      body: JSON.stringify({ site_id: site.id, url: input.url, referrer: input.referrer }),
      cache: 'no-store', redirect: 'error', credentials: 'omit',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
    })
    if (!upstream.ok) {
      void upstream.body?.cancel().catch(() => {})
      const status = [400, 403, 429, 503].includes(upstream.status) ? upstream.status : 502
      return failure('Visitor session could not be created.', status)
    }
    if (!upstream.headers.get('content-type')?.includes('application/json')) {
      void upstream.body?.cancel().catch(() => {})
      return failure('Invalid visitor session response', 502)
    }
    const result = sessionSchema.safeParse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(upstream as unknown as Request, 16_384))))
    if (!result.success || result.data.data.site_id !== site.id || result.data.data.expires_at <= Date.now()) {
      return failure('Invalid visitor session response', 502)
    }
    return Response.json(result.data, { status: 201, headers: { 'Cache-Control': 'no-store, private', Vary: 'Origin' } })
  } catch {
    // A failed response may follow session creation; do not automatically mint another session.
    return failure('Visitor session is temporarily unavailable.', 503)
  }
}