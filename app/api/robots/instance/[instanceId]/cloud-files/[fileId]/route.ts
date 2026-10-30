import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { cloudRevisionFormat } from '@/lib/cloud-file-url'
import { readLimitedRequestBody } from '@/lib/http/read-limited-request-body'

export const runtime = 'nodejs'

const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
}

function failure(status: number) {
  return Response.json({ error: status === 401 ? 'Authentication required' :
    status === 403 ? 'Forbidden' : status === 404 ? 'Not found' :
      status === 400 ? 'Invalid cloud revision request' : 'Cloud files unavailable' },
  { status, headers: privateHeaders })
}

function apiOrigin(request: Request): URL | null {
  try {
    const configured = process.env.API_SERVER_URL
    if (!configured) return null
    const base = new URL(configured)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
    if (base.username || base.password || base.pathname !== '/' || base.search || base.hash ||
      (base.protocol !== 'https:' && !(base.protocol === 'http:' && local && process.env.NODE_ENV !== 'production')) ||
      base.origin === new URL(request.url).origin) return null
    return base
  } catch {
    return null
  }
}

export async function GET(request: Request, context: { params: Promise<{ instanceId: string; fileId: string }> }) {
  try {
    const url = new URL(request.url)
    const origin = request.headers.get('origin')
    if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return failure(403)
    const ids = z.object({ instanceId: z.string().uuid(), fileId: z.string().uuid() }).safeParse(await context.params)
    if (!ids.success) return failure(400)
    const path = `/api/robots/instance/${ids.data.instanceId}/cloud-files/${ids.data.fileId}`
    const format = cloudRevisionFormat(path + url.search)
    if (!format) return failure(400)

    // Bypass demo identities; only a verified user's own session can reach the API.
    const supabase = await createClient(true)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return failure(401)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.access_token || session.user?.id !== user.id) return failure(401)
    const base = apiOrigin(request)
    if (!base) return failure(503)
    const target = new URL(path, base)
    target.search = url.search
    // The API authorizes this user's instance, requirement, file and revision scope.
    const upstream = await fetch(target, {
      method: 'GET', headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30_000),
    })
    if (!upstream.ok) {
      await upstream.body?.cancel()
      return failure([400, 401, 403, 404, 429, 503].includes(upstream.status) ? upstream.status : 502)
    }
    const contentType = format === 'zip' ? 'application/zip' : 'text/plain'
    if (upstream.headers.get('content-type')?.split(';')[0].trim() !== contentType) {
      await upstream.body?.cancel()
      return failure(502)
    }
    // Revisions are capped at 256 KiB upstream; bound ZIP overhead without decoding bytes.
    const bytes = await readLimitedRequestBody(upstream as unknown as Request, 1024 * 1024)
    const headers = new Headers(privateHeaders)
    headers.set('Content-Type', format === 'zip' ? contentType : `${contentType}; charset=utf-8`)
    headers.set('Content-Disposition', `attachment; filename="${ids.data.fileId}-v${url.searchParams.get('version')}.${format === 'zip' ? 'zip' : 'txt'}"`)
    const sha = upstream.headers.get('x-cloud-file-sha256')
    if (sha && /^[0-9a-f]{64}$/.test(sha)) headers.set('X-Cloud-File-Sha256', sha)
    return new Response(new Uint8Array(bytes), { headers })
  } catch {
    // Never log provider errors: they can contain authenticated request details.
    return failure(502)
  }
}