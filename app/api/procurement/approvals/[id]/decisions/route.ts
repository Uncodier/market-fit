import { z } from 'zod'
import { operationalRequestAccess, requestBody, databaseError, resultJson } from '../../../requests/http'
import { procurementError, uuid } from '../../../http'

const schema = z.object({ stage_id: uuid, decision: z.enum(['approve', 'reject']), reason: z.string().trim().min(1).max(2000) }).strict()
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await operationalRequestAccess(request, true)
    if (access.error) return access.error
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError('Invalid approval', 400)
    const parsed = await requestBody(request, schema)
    if (parsed.error) return parsed.error
    const saved = await access.supabase.rpc('decide_procurement_event', { p_site: access.siteId, p_id: id.data,
      p_stage: parsed.data!.stage_id, p_decision: parsed.data!.decision, p_reason: parsed.data!.reason })
    return databaseError(saved.error) ?? resultJson({ id: saved.data })
  } catch { return procurementError('Unable to record approval decision', 503) }
}