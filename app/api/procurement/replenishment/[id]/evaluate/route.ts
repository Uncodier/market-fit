import { z } from 'zod'
import { procurementAccess, procurementError, uuid } from '../../../http'
import { requestBody, resultJson, databaseError } from '../../../requests/http'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await procurementAccess(request)
    if (access.error) return access.error
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError('Invalid replenishment rule', 400)
    const parsed = await requestBody(request, z.object({}).strict())
    if (parsed.error) return parsed.error
    const result = await access.supabase.rpc('evaluate_procurement_replenishment_rule', { p_site: access.siteId, p_rule: id.data })
    return databaseError(result.error) ?? resultJson(result.data)
  } catch { return procurementError('Unable to check inventory; no requisition confirmed', 503) }
}