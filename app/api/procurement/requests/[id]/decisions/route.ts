import { procurementError, uuid } from '../../../http'
import { requestDecisionSchema } from '@/app/purchases/requests/schema'
import { databaseError, requestBody, resultJson, operationalRequestAccess } from '../../http'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await operationalRequestAccess(request, true)
    if (access.error) return access.error
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError('Invalid request identifier', 400)
    const parsed = await requestBody(request, requestDecisionSchema)
    if (parsed.error) return parsed.error
    const value = parsed.data!
    const { data, error } = await access.supabase.rpc('decide_procurement_request', {
      p_site: access.siteId, p_id: id.data, p_revision: value.expected_revision,
      p_stage: value.stage_id, p_decision: value.decision, p_reason: value.reason,
    })
    return databaseError(error) ?? resultJson({ id: data })
  } catch { return procurementError('Unable to record decision', 503) }
}
