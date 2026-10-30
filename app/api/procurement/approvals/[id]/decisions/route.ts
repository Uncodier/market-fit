import { z } from 'zod'
import { operationalRequestAccess, requestBody, databaseError, resultJson } from '../../../requests/http'
import { procurementError, uuid } from '../../../http'
import { decisionBusinessError } from '../../decision-errors'
import { approvalRevisionState } from '../../revision-state'

const schema = z.object({ stage_id: uuid, decision: z.enum(['approve', 'reject']), reason: z.string().trim().min(1).max(2000) }).strict()
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await operationalRequestAccess(request, true)
    if (access.error) return access.error
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError('Invalid approval', 400)
    const parsed = await requestBody(request, schema)
    if (parsed.error) return parsed.error
    // The database rechecks revisions atomically when recording each vote.
    const approval = await access.supabase.from('procurement_event_approvals')
      .select('event,target_id,target_version,policy_revision,status').eq('site_id', access.siteId).eq('id', id.data).maybeSingle()
    if (approval.error) return procurementError('Unable to verify approval revision', 503)
    if (!approval.data) return procurementError('Invalid approval', 404)
    if (approval.data.status !== 'pending') return decisionBusinessError({ code: 'PT409', message: 'Approval changed' })!
    if (parsed.data!.decision === 'approve') {
      const [revision] = await approvalRevisionState(access.supabase, access.siteId, [approval.data])
      if (revision.is_deprecated) return procurementError(revision.policy_changed
        ? 'The workspace policy changed after this approval was requested. Open the document and request a new approval under the current policy.'
        : 'Tender changed. Request publication approval for the current working version from the tender details.', 409)
    }
    const saved = await access.supabase.rpc('decide_procurement_event', { p_site: access.siteId, p_id: id.data,
      p_stage: parsed.data!.stage_id, p_decision: parsed.data!.decision, p_reason: parsed.data!.reason })
    if (saved.error?.code === '22023' && saved.error.message === 'Tender portal is disabled') {
      return procurementError('Tender portal is disabled. Enable the workspace tender portal from the tender details before approving publication.', 409)
    }
    if (saved.error?.code === '22023' && saved.error.message === 'Global listing disabled by policy') {
      return procurementError('Global directory listing is disabled by workspace policy. Allow it in Settings > Tenders or remove this tender from the global directory, then request a new publication approval.', 409)
    }
    if (saved.error?.code === '40001' && saved.error.message === 'Tender version conflict') {
      return procurementError('Tender changed. Request publication approval for the current working version from the tender details.', 409)
    }
    return decisionBusinessError(saved.error) ?? databaseError(saved.error) ?? resultJson({ id: saved.data })
  } catch { return procurementError('Unable to record approval decision', 503) }
}