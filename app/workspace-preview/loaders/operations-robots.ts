import { getInstanceStatusLabel } from '@/app/components/robots/instance-browser-model'
import {
  PREVIEW_LIMIT, readPreviewRows, WorkspacePreviewError, type WorkspacePreviewInput, type WorkspacePreviewRow,
} from '@/app/workspace-preview/types'
import { authenticatedOperationsClient, previewRow, readAdmission } from './operations-access'

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

// Only /robots?mode=workflow with the workflows screen proof. This previews
// the instance picker, never a workflow graph, provider URL, or instance detail.
export async function robotsPreview(input: WorkspacePreviewInput): Promise<WorkspacePreviewRow[]> {
  const { siteId, actorId, signal } = input
  const db = await authenticatedOperationsClient(input)
  const [membership, capabilities] = await Promise.all([
    readAdmission(db.from('site_members').select('status,role,restrict_to_assigned_only')
      .eq('site_id', siteId).eq('user_id', actorId).maybeSingle(), signal),
    readAdmission(db.rpc('get_my_site_capabilities', { p_site_id: siteId }, { get: true }), signal),
  ])
  // Require the canonical RPC object, not the client role-derived default.
  // Missing/legacy shapes may wait for the regular provider; never infer select.
  const caps = object(capabilities)
  if (!caps || caps.select !== true) throw new WorkspacePreviewError(caps?.select === false)
  const owner = caps.role === 'owner'
  if (caps.is_owner !== owner) throw new WorkspacePreviewError()
  let assignedOnly = false
  if (!owner) {
    if (caps.role !== 'admin' && caps.role !== 'marketing' && caps.role !== 'collaborator') throw new WorkspacePreviewError()
    const member = object(membership)
    if (!member || member.status !== 'active') throw new WorkspacePreviewError(true)
    if (member.role !== caps.role || typeof member.restrict_to_assigned_only !== 'boolean') throw new WorkspacePreviewError()
    assignedOnly = member.restrict_to_assigned_only
  }
  let query = db.from('remote_instances').select('id,name,status').eq('site_id', siteId).eq('is_archived', false)
  // Match instance_row_access: for restricted members either authenticated
  // attribution is valid. This can only narrow the session's RLS result.
  if (assignedOnly) query = query.or(`user_id.eq.${actorId},created_by.eq.${actorId}`)
  const rows = await readPreviewRows<{ id: string; name: string | null; status: string }>(
    query.order('updated_at', { ascending: false }).order('id', { ascending: true }).limit(PREVIEW_LIMIT), signal,
  )
  return rows.map(row => previewRow(row.id, row.name || `ag-${row.id.slice(-4)}`, getInstanceStatusLabel(row.status)))
}