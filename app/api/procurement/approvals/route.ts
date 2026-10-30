import { NextResponse } from 'next/server'
import { operationalRequestAccess } from '../requests/http'
import { privateHeaders, procurementError, uuid } from '../http'
import { approvalRevisionState } from './revision-state'
import { approverNames } from './approver-names'

type ApprovalRow = {
  id: string; target_id: string; target_version: number; event: string
  policy_revision: number; status: string; created_at: string
  procurement_event_stages: {
    id: string; position: number; definition: Record<string, unknown>; status: string
    procurement_event_decisions: { actor_id: string; decision: string }[]
  }[]
}

export async function GET(request: Request) {
  try {
    const access = await operationalRequestAccess(request)
    if (access.error) return access.error
    const target = new URL(request.url).searchParams.get('target_id')
    if (target && !uuid.safeParse(target).success) return procurementError('Invalid approval target', 400)
    let query = access.supabase.from('procurement_event_approvals')
      .select('id,target_id,target_version,event,policy_revision,status,created_at,procurement_event_stages(id,position,definition,status,procurement_event_decisions(actor_id,decision))')
      .eq('site_id', access.siteId).order('created_at', { ascending: false }).limit(100)
    if (target) query = query.eq('target_id', target)
    const { data, error } = await query
    if (error) return procurementError('Unable to load approvals', 503)
    const approvals = await approvalRevisionState<ApprovalRow>(access.supabase, access.siteId, data ?? [])
    const assignedIds = (definition: Record<string, unknown>) => Array.isArray(definition.approverIds)
      ? definition.approverIds.filter((id): id is string => typeof id === 'string') : []
    const userIds = [...new Set(approvals.flatMap(approval => approval.procurement_event_stages.flatMap(stage => [
      ...assignedIds(stage.definition), ...stage.procurement_event_decisions.map(vote => vote.actor_id),
    ])))]
    const { names, ownerId } = await approverNames(access.supabase, access.siteId, userIds)
    const summaries = approvals.map(approval => ({ ...approval,
      procurement_event_stages: approval.procurement_event_stages.map(stage => {
        const { procurement_event_decisions: decisions, ...saved } = stage
        return { ...saved,
          approval_votes: decisions.filter(vote => vote.decision === 'approve').length,
          own_decision: decisions.find(vote => vote.actor_id === access.userId)?.decision ?? null,
          voters: [...new Set([...assignedIds(stage.definition), ...decisions.map(vote => vote.actor_id)])].map(userId => ({
            user_id: userId, name: names.get(userId) ?? null, is_owner: userId === ownerId,
            is_self: userId === access.userId,
            mandatory: Array.isArray(stage.definition.mandatoryApproverIds) && stage.definition.mandatoryApproverIds.includes(userId),
            decision: decisions.find(vote => vote.actor_id === userId)?.decision ?? null,
          })),
        }
      }),
    }))
    return NextResponse.json({ approvals: summaries }, { headers: privateHeaders })
  } catch { return procurementError('Unable to load approvals', 503) }
}