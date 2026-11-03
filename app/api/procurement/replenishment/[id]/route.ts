import { z } from 'zod'
import { procurementAccess, procurementError, uuid } from '../../http'
import { resultJson } from '../../requests/http'
import { replenishmentPageSize } from '@/app/purchases/procurement/replenishment/schema'

const page = z.string().regex(/^[1-9]\d{0,5}$/).transform(Number).default('1')
const paging = z.object({ case_page: page, request_page: page }).strict()
const ruleColumns = 'id,name,catalog_item_id,location_id,minimum,target,minimum_order,order_multiple,action,enabled,version,created_by,updated_by,created_at,updated_at'
const caseColumns = 'id,rule_id,rule_version,catalog_item_id,location_id,status,request_id,observed_quantity,quantity,action,created_by,created_at,closed_by,closed_at,close_reason'
const requestColumns = 'id,title,status,currency,net_amount_minor,revision'
type RequestSummary = { id: string; title: string; status: string; currency: string; net_amount_minor: number | string | null; revision: number }

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await procurementAccess(request)
    if (access.error) return access.error
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError('Invalid replenishment rule identifier', 400)
    const params = new URL(request.url).searchParams
    const input = paging.safeParse({ case_page: params.get('case_page') ?? undefined, request_page: params.get('request_page') ?? undefined })
    if (!input.success || [...params.keys()].some(key => !['site_id', 'case_page', 'request_page'].includes(key) || params.getAll(key).length !== 1)) {
      return procurementError('Invalid replenishment page', 400)
    }
    const { supabase, siteId } = access
    const rule = await supabase.from('procurement_replenishment_rules').select(ruleColumns)
      .eq('site_id', siteId).eq('id', id.data).maybeSingle()
    if (rule.error) return procurementError('Unable to load replenishment rule', 503)
    if (!rule.data) return procurementError('Replenishment rule not found', 404)
    const { case_page: casePage, request_page: requestPage } = input.data
    const caseStart = (casePage - 1) * replenishmentPageSize
    const requestStart = (requestPage - 1) * replenishmentPageSize
    const [queue, cases, requests, product, location] = await Promise.all([
      supabase.from('procurement_replenishment_queue')
        .select('rule_id,generation,evaluated_generation,last_result,last_error,evaluated_at')
        .eq('site_id', siteId).eq('rule_id', id.data).maybeSingle(),
      supabase.from('procurement_replenishment_cases').select(caseColumns, { count: 'exact' })
        .eq('site_id', siteId).eq('rule_id', id.data)
        .order('created_at', { ascending: false }).order('id')
        .range(caseStart, caseStart + replenishmentPageSize - 1),
      // The composite FK enforces tenant identity; UNIQUE(request_id) makes the
      // case count an exact request count, including links from closed cases.
      supabase.from('procurement_replenishment_cases')
        .select(`request:procurement_requests!procurement_replenishment_cases_site_id_request_id_fkey!inner(${requestColumns})`, { count: 'exact' })
        .eq('site_id', siteId).eq('rule_id', id.data).not('request_id', 'is', null)
        .eq('request.site_id', siteId)
        .order('created_at', { ascending: false }).order('id')
        .range(requestStart, requestStart + replenishmentPageSize - 1),
      supabase.from('catalog_items').select('name').eq('site_id', siteId).eq('id', rule.data.catalog_item_id).maybeSingle(),
      supabase.from('locations').select('name').eq('site_id', siteId).eq('id', rule.data.location_id).maybeSingle(),
    ])
    if (queue.error || cases.error || requests.error || product.error || location.error) {
      return procurementError('Unable to load replenishment history or references', 503)
    }
    if (!Number.isSafeInteger(cases.count) || cases.count < 0 || !Number.isSafeInteger(requests.count) || requests.count < 0) {
      return procurementError('Unable to confirm replenishment totals', 503)
    }
    return resultJson({
      rule: { ...rule.data, catalog_item_name: product.data?.name ?? null, location_name: location.data?.name ?? null },
      queue: queue.data ?? null,
      cases: cases.data ?? [], case_count: cases.count, case_page: casePage,
      requests: (requests.data ?? []).map((row: { request: RequestSummary }) => row.request),
      request_count: requests.count, request_page: requestPage, page_size: replenishmentPageSize,
    })
  } catch { return procurementError('Unable to load replenishment rule', 503) }
}