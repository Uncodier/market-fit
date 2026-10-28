import { procurementAccess, procurementError } from '../http'
import { saveRequestSchema } from '@/app/purchases/requests/schema'
import { databaseError, requestBody, resultJson, summaryColumns, operationalRequestAccess } from './http'

export async function GET(request: Request) {
  try {
    const access = await operationalRequestAccess(request)
    if (access.error) return access.error
    const params = new URL(request.url).searchParams
    const page = Number(params.get('page') ?? '0')
    const status = params.get('status')
    const sourcing = params.get('sourcing') ?? 'all'
    const search = (params.get('search') ?? '').trim()
    const canManage = ['owner', 'admin'].includes(access.role)
    if (!Number.isSafeInteger(page) || page < 0 || page > 10000 || (status && !['draft', 'submitted', 'approved', 'rejected', 'returned'].includes(status))
      || !['all', 'with_tender', 'without_tender'].includes(sourcing) || search.length > 200
      || ['page', 'status', 'sourcing', 'search'].some(key => params.getAll(key).length > 1)) {
      return procurementError('Invalid request filters', 400)
    }
    // Tender reads are manager-only. Hidden relationships must not be interpreted
    // as evidence that a requisition follows direct purchasing.
    if (!canManage && sourcing !== 'all') return procurementError('Tender relationship filters require workspace management access', 403)
    const columns = canManage ? `${summaryColumns},tenders:procurement_tenders(id,title,status)` : summaryColumns
    let query = access.supabase.from('procurement_requests').select(columns, { count: 'exact' }).eq('site_id', access.siteId)
    if (status) query = query.eq('status', status)
    if (search) query = query.ilike('title', `%${search.replace(/[\\%_]/g, '\\$&')}%`)
    if (sourcing === 'with_tender') query = query.not('tenders', 'is', null)
    if (sourcing === 'without_tender') query = query.is('tenders', null)
    const { data, error, count } = await query.order('updated_at', { ascending: false }).order('id').range(page * 50, page * 50 + 49)
    return databaseError(error) ?? resultJson({ requests: data, count, page, can_manage: canManage })
  } catch { return procurementError('Unable to load requests', 503) }
}
export async function POST(request: Request) {
  try {
    const access = await procurementAccess(request)
    if (access.error) return access.error
    const parsed = await requestBody(request, saveRequestSchema)
    if (parsed.error) return parsed.error
    if (parsed.data!.expected_revision !== 0) return procurementError('New requests start at revision zero', 400)
    const { data, error } = await access.supabase.rpc('save_procurement_request', {
      p_site: access.siteId, p_id: null, p_revision: 0, p_document: parsed.data!.document,
    })
    return databaseError(error) ?? resultJson({ id: data })
  } catch { return procurementError('Unable to save request', 503) }
}
