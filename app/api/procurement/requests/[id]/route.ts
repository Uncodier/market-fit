import { procurementAccess, procurementError, uuid } from '../../http'
import { saveRequestSchema } from '@/app/purchases/requests/schema'
import { databaseError, requestBody, resultJson, operationalRequestAccess } from '../http'

type Context = { params: Promise<{ id: string }> }
export async function GET(request: Request, context: Context) {
  try {
    const access = await operationalRequestAccess(request)
    if (access.error) return access.error
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError('Invalid request identifier', 400)
    const { data, error } = await access.supabase.from('procurement_requests').select('*').eq('site_id', access.siteId).eq('id', id.data).maybeSingle()
    if (error) return databaseError(error)!
    if (!data) return procurementError('Request not found', 404)
    const [items, stages, audit] = await Promise.all([
      access.supabase.from('procurement_request_items').select('*').eq('request_id', id.data).order('revision').order('position'),
      access.supabase.from('procurement_request_stages').select('*,decisions:procurement_request_decisions(*)').eq('request_id', id.data).order('revision').order('position'),
      access.supabase.from('procurement_request_audit').select('*').eq('request_id', id.data).order('created_at', { ascending: false }).limit(200),
    ])
    if (items.error || stages.error || audit.error) return procurementError('Unable to load request history', 503)
    return resultJson({ request: data, items: items.data, stages: stages.data, audit: audit.data, actor_id: access.userId,
      can_manage: ['owner', 'admin'].includes(access.role) })
  } catch { return procurementError('Unable to load request', 503) }
}
export async function PUT(request: Request, context: Context) {
  try {
    const access = await procurementAccess(request)
    if (access.error) return access.error
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError('Invalid request identifier', 400)
    const parsed = await requestBody(request, saveRequestSchema)
    if (parsed.error) return parsed.error
    const { data, error } = await access.supabase.rpc('save_procurement_request', {
      p_site: access.siteId, p_id: id.data, p_revision: parsed.data!.expected_revision, p_document: parsed.data!.document,
    })
    return databaseError(error) ?? resultJson({ id: data })
  } catch { return procurementError('Unable to save request', 503) }
}
