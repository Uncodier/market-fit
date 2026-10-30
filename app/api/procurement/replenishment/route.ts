import { procurementAccess, procurementError } from '../http'
import { requestBody, resultJson, databaseError } from '../requests/http'
import { saveReplenishmentSchema, replenishmentListSchema, replenishmentPageSize } from '@/app/purchases/procurement/replenishment/schema'

export async function GET(request: Request) {
  try {
    const access = await procurementAccess(request)
    if (access.error) return access.error
    const params = new URL(request.url).searchParams
    const input = replenishmentListSchema.safeParse({ page: params.get('page') ?? undefined, case_page: params.get('case_page') ?? undefined })
    if (!input.success || params.getAll('page').length > 1 || params.getAll('case_page').length > 1
      || [...params.keys()].some(key => !['site_id', 'page', 'case_page'].includes(key))) return procurementError('Invalid replenishment page', 400)
    const { page, case_page: casePage } = input.data
    const start = (page - 1) * replenishmentPageSize, caseStart = (casePage - 1) * replenishmentPageSize
    const [result, cases] = await Promise.all([
      access.supabase.from('procurement_replenishment_rules')
        .select('id,name,catalog_item_id,location_id,minimum,target,minimum_order,order_multiple,action,enabled,version', { count: 'exact' })
        .eq('site_id', access.siteId).order('name').order('id').range(start, start + replenishmentPageSize - 1),
      access.supabase.from('procurement_replenishment_cases').select('id,rule_id,status,request_id,observed_quantity,quantity,action,created_at', { count: 'exact' })
        .eq('site_id', access.siteId).eq('status', 'open').order('created_at', { ascending: false }).order('id')
        .range(caseStart, caseStart + replenishmentPageSize - 1),
    ])
    if (result.error) return procurementError('Unable to load replenishment rules. Check the required migration.', 503)
    if (cases.error) return procurementError('Unable to load replenishment cases', 503)
    if (!Number.isSafeInteger(result.count) || !Number.isSafeInteger(cases.count)) return procurementError('Unable to confirm replenishment totals', 503)
    const ruleIds = (result.data ?? []).map((rule: { id: string }) => rule.id)
    const caseRuleIds = [...new Set<string>((cases.data ?? []).map((item: { rule_id: string }) => item.rule_id))]
    const [queue, names] = await Promise.all([
      ruleIds.length ? access.supabase.from('procurement_replenishment_queue').select('rule_id,generation,evaluated_generation,last_result,last_error,evaluated_at')
        .eq('site_id', access.siteId).in('rule_id', ruleIds) : { data: [], error: null },
      caseRuleIds.length ? access.supabase.from('procurement_replenishment_rules').select('id,name')
        .eq('site_id', access.siteId).in('id', caseRuleIds) : { data: [], error: null },
    ])
    if (queue.error || names.error) return procurementError('Unable to load replenishment references or worker status', 503)
    const labels = new Map<string, string>((names.data ?? []).map((rule: { id: string; name: string }) => [rule.id, rule.name]))
    return resultJson({ rules: result.data ?? [], cases: (cases.data ?? []).map((item: { rule_id: string }) => ({ ...item, rule_name: labels.get(item.rule_id) ?? 'Replenishment' })),
      queue: queue.data, rule_count: result.count, case_count: cases.count, page, case_page: casePage, page_size: replenishmentPageSize })
  } catch { return procurementError('Unable to load replenishment rules', 503) }
}

export async function POST(request: Request) {
  try {
    const access = await procurementAccess(request)
    if (access.error) return access.error
    const parsed = await requestBody(request, saveReplenishmentSchema)
    if (parsed.error) return parsed.error
    const input = parsed.data!
    const result = await access.supabase.rpc('save_procurement_replenishment_rule', {
      p_site: access.siteId, p_id: input.id, p_version: input.expected_version, p_document: input.document,
    })
    return databaseError(result.error) ?? resultJson({ id: result.data })
  } catch { return procurementError('Unable to save replenishment rule', 503) }
}