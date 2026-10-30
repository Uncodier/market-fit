import { procurementError, uuid } from '../../http'
import { saveTenderSchema, tenderActionSchema } from '@/app/purchases/tenders/schema'
import { requestBody, resultJson, tenderAccess, tenderColumns, tenderError } from '../http'

type Context = { params: Promise<{ id: string }> }
export async function GET(request: Request, context: Context) {
  try {
    const access = await tenderAccess(request)
    if (access.error) return access.error
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError('Invalid tender', 400)
    const { data, error } = await access.supabase.from('procurement_tenders').select(tenderColumns).eq('site_id', access.siteId).eq('id', id.data).maybeSingle()
    if (error) return tenderError(error)!
    if (!data) return procurementError('Tender not found', 404)
    const [publications, participants, portal, pendingPublication, receipts] = await Promise.all([
      access.supabase.from('procurement_tender_publications').select('id,version,published_at,snapshot,visibility,global_visible').eq('site_id', access.siteId).eq('tender_id', id.data).order('version', { ascending: false }),
      access.supabase.from('procurement_tender_participants').select('id,supplier_id,status,created_at,suppliers(name)').eq('site_id', access.siteId).eq('tender_id', id.data).order('created_at'),
      access.supabase.from('procurement_tender_portals').select('slug,enabled').eq('site_id', access.siteId).maybeSingle(),
      access.supabase.from('procurement_event_approvals').select('id').eq('site_id', access.siteId)
        .eq('target_id', id.data).eq('target_version', data.version).eq('event', 'publication').eq('status', 'pending').limit(1),
      access.supabase.rpc('list_procurement_receipt_activity', { p_site: access.siteId, p_tender: id.data }),
    ])
    const childError = publications.error || participants.error || portal.error || pendingPublication.error || receipts.error
    return tenderError(childError) ?? resultJson({ tender: data, publications: publications.data, receipt_activity: receipts.data, participants: participants.data, site_slug: portal.data?.slug, portal_enabled: portal.data?.enabled === true, publication_pending: Boolean(pendingPublication.data?.length) })
  } catch { return procurementError('Unable to load tender', 503) }
}
export async function PUT(request: Request, context: Context) {
  try {
    const access = await tenderAccess(request, 'update')
    if (access.error) return access.error
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError('Invalid tender', 400)
    const parsed = await requestBody(request, saveTenderSchema)
    if (parsed.error) return parsed.error
    if (parsed.data!.expected_version < 1) return procurementError('Expected version is required', 400)
    const { data, error } = await access.supabase.rpc('save_procurement_tender', { p_site: access.siteId, p_id: id.data, p_version: parsed.data!.expected_version, p_document: parsed.data!.document })
    return tenderError(error) ?? resultJson({ id: data })
  } catch { return procurementError('Unable to update tender', 503) }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const access = await tenderAccess(request, 'update')
    if (access.error) return access.error
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError('Invalid tender', 400)
    const parsed = await requestBody(request, tenderActionSchema)
    if (parsed.error) return parsed.error
    const { error } = await access.supabase.rpc('transition_procurement_tender', { p_site: access.siteId, p_id: id.data, p_version: parsed.data!.expected_version, p_action: parsed.data!.action })
    return tenderError(error) ?? resultJson({ ok: true })
  } catch { return procurementError('Unable to change tender state', 503) }
}