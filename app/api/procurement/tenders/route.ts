import { procurementError } from '../http'
import { saveTenderSchema } from '@/app/purchases/tenders/schema'
import { tenderAccess, requestBody, resultJson, tenderColumns, tenderError } from './http'

export async function GET(request: Request) {
  try {
    const access = await tenderAccess(request)
    if (access.error) return access.error
    const params = new URL(request.url).searchParams
    const page = Number(params.get('page') ?? '0'), status = params.get('status'), search = params.get('search') ?? ''
    if (!Number.isSafeInteger(page) || page < 0 || page > 10000 || search.length > 200 || (status && !['draft', 'published', 'closed', 'cancelled'].includes(status))) return procurementError('Invalid tender filters', 400)
    let query = access.supabase.from('procurement_tenders').select(tenderColumns, { count: 'exact' }).eq('site_id', access.siteId)
    if (status) query = query.eq('status', status)
    if (search) query = query.ilike('title', `%${search.replace(/[\\%_]/g, '\\$&')}%`)
    const { data, error, count } = await query.order('updated_at', { ascending: false }).order('id').range(page * 50, page * 50 + 49)
    return tenderError(error) ?? resultJson({ tenders: data, count, page })
  } catch { return procurementError('Unable to load tenders', 503) }
}
export async function POST(request: Request) {
  try {
    const access = await tenderAccess(request, 'update')
    if (access.error) return access.error
    const parsed = await requestBody(request, saveTenderSchema)
    if (parsed.error) return parsed.error
    if (parsed.data!.expected_version !== 0) return procurementError('New tenders start at version zero', 400)
    const { data, error } = await access.supabase.rpc('save_procurement_tender', { p_site: access.siteId, p_id: null, p_version: 0, p_document: parsed.data!.document })
    return tenderError(error) ?? resultJson({ id: data })
  } catch { return procurementError('Unable to create tender', 503) }
}