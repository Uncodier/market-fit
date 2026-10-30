import { z } from 'zod'
import { procurementAccess, procurementError, uuid } from '../../../../http'
import { requestBody, resultJson, databaseError } from '../../../../requests/http'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await procurementAccess(request)
    if (access.error) return access.error
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError('Invalid replenishment case', 400)
    const parsed = await requestBody(request, z.object({ reason: z.string().trim().min(1).max(2000) }).strict())
    if (parsed.error) return parsed.error
    const result = await access.supabase.rpc('close_procurement_replenishment_case', { p_site: access.siteId, p_case: id.data, p_reason: parsed.data!.reason })
    return databaseError(result.error) ?? resultJson({ id: result.data })
  } catch { return procurementError('Unable to close replenishment case', 503) }
}