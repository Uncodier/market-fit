import { z } from 'zod'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { userCanOnSite } from '@/lib/permissions/site-access'
import { configuredApiUrl, isSameOriginApiRequest } from '@/lib/http/api-proxy-security'
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from '@/lib/http/read-limited-request-body'

export const maxDuration = 30
const inputSchema = z.object({ site_id: z.string().uuid() })
const acceptedSchema = z.object({
  success: z.literal(true),
  data: z.object({ workflow_id: z.string().min(1).max(300), site_id: z.string().uuid() }),
})

function failure(message: string, status: number) {
  return Response.json({ success: false, error: { message } }, {
    status, headers: { 'Cache-Control': 'no-store, private' },
  })
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginApiRequest(request)) return failure('Origin not allowed', 403)
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return failure('JSON content type required', 415)
  }
  let siteId: string
  try {
    siteId = inputSchema.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 4_096)))).site_id
  } catch (error) {
    return failure('Invalid site setup request', error instanceof RequestBodyTooLargeError ? 413 : 400)
  }

  const access = await requireSiteAccess(request, siteId, { requireManager: true })
  if (access.error) return access.error
  if (!await userCanOnSite(access.supabase, siteId, 'update')) return failure('Site setup is not permitted.', 403)
  const { data: { session }, error } = await access.supabase.auth.getSession()
  if (error || !session?.access_token || session.user?.id !== access.userId) {
    return failure('Please sign in again to configure this site.', 401)
  }
  const target = configuredApiUrl(request, '/api/site/setup')
  if (!target) return failure('Site setup API is not configured', 503)

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ site_id: siteId, user_id: access.userId }),
      cache: 'no-store', redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12_000)]),
    })
    if (!upstream.ok) {
      await upstream.body?.cancel()
      const status = [400, 401, 403, 409, 429, 503].includes(upstream.status) ? upstream.status : 502
      return failure(status === 401 ? 'Please sign in again to configure this site.'
        : status === 403 ? 'Site setup is not permitted.' : 'Site setup could not be confirmed. Check its status before retrying.', status)
    }
    if (!upstream.headers.get('content-type')?.includes('application/json')) {
      await upstream.body?.cancel()
      return failure('Invalid site setup response', 502)
    }
    const data = acceptedSchema.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(upstream as unknown as Request, 64_000))))
    if (data.data.site_id !== siteId) return failure('Invalid site setup response', 502)
    return Response.json(data, { headers: { 'Cache-Control': 'no-store, private' } })
  } catch {
    return failure('Site setup could not be confirmed. Check its status before retrying.', 502)
  }
}