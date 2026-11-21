import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { configuredApiUrl, isSameOriginApiRequest } from '@/lib/http/api-proxy-security'
import { readLimitedRequestBody, decodeRequestBody, RequestBodyTooLargeError } from '@/lib/http/read-limited-request-body'
import { resultId, reportSchema, indexSchema, unavailable, resultPage, indexPage, privateHeaders } from './private-report-document'

async function actor() {
  // Never substitute demo or service-role access. The read RPC independently checks
  // signed identity and current resource authorization, even if called outside the web.
  const db = await createClient(true)
  const { data: { user }, error } = await db.auth.getUser()
  return !error && user && resultId.safeParse(user.id).success && user.is_anonymous === false ? { db, userId: user.id } : null
}
export async function showPrivateReport(req: Request, id?: string) {
  try {
    if (new URL(req.url).search || (id !== undefined && !resultId.safeParse(id).success)) return unavailable(400)
    const auth = await actor()
    if (!auth) return unavailable(401)
    const query = id ? auth.db.rpc('read_connector_private_result', { p_id: id }) : auth.db.rpc('list_connector_private_results')
    const { data, error } = await query.abortSignal(AbortSignal.timeout(5000))
    if (error) return unavailable(503)
    if (id && data == null) return unavailable(404)
    if (id) {
      const report = reportSchema.safeParse(data)
      return report.success ? resultPage(id, report.data) : unavailable(503)
    }
    const items = indexSchema.safeParse(data)
    return items.success ? indexPage(items.data) : unavailable(503)
  } catch { return unavailable(503) }
}

export async function followPrivateChoice(req: Request, id: string) {
  try {
    if (!req.headers.get('origin') || !isSameOriginApiRequest(req)) return unavailable(403)
    if (!resultId.safeParse(id).success || new URL(req.url).search) return unavailable(400)
    if (req.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') return unavailable(415)
    const raw = decodeRequestBody(await readLimitedRequestBody(req, 32))
    if (!/^choice=(-1|[0-9]|1[0-9]|2[0-4])$/.test(raw)) return unavailable(400)
    const choice = Number(raw.slice(7)), auth = await actor()
    if (!auth) return unavailable(401)
    // Authorization belongs to the actor-bound database RPC; this BFF must not
    // forward an arbitrary ID/actor and rely solely on the upstream check.
    const { data, error } = await auth.db.rpc('connector_private_report_choice', { p_id: id, p_choice: choice }).abortSignal(AbortSignal.timeout(5000))
    if (error) return unavailable(503)
    if (data?.user_id !== auth.userId) return unavailable(404)
    const { data: { session }, error: sessionError } = await auth.db.auth.getSession()
    if (sessionError || !session?.access_token || session.user?.id !== auth.userId) return unavailable(401)
    const target = configuredApiUrl(req, `/api/connectors/private-results/${id}/open`)
    if (!target) return unavailable(503)
    const upstream = await fetch(target, { method: 'POST', cache: 'no-store', redirect: 'error',
      headers: { authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify({ choice }),
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(45_000)]) })
    if (!upstream.ok) return unavailable([401,403,404,409,429].includes(upstream.status) ? upstream.status : 503)
    const reply = z.object({ id: resultId }).strict().safeParse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(upstream as unknown as Request, 256))))
    if (!reply.success) return unavailable(503)
    return new Response(null, { status: 303, headers: { ...privateHeaders, Location: `/connectors/results/${reply.data.id}` } })
  } catch (error) { return unavailable(error instanceof RequestBodyTooLargeError ? 413 : 503) }
}