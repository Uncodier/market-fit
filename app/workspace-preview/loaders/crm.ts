import { createClient } from '@/lib/supabase/client'
import {
  PREVIEW_LIMIT, readPreviewRows, WorkspacePreviewError,
  type WorkspacePreviewInput, type WorkspacePreviewRow,
} from '@/app/workspace-preview/types'

// The shell verifies the actor and screen. Never use input.actorId to decide
// ownership: the table policies apply the current JWT's site and assignment rules.
function crmClient() {
  const client = createClient()
  if (client._isMock || client._isDemo) throw new WorkspacePreviewError()
  return client
}

type LabelProjection = { id: string; label: string | null }

function previewRow(row: LabelProjection): WorkspacePreviewRow {
  if (!row || typeof row.id !== 'string' || !row.id.trim() ||
      (row.label !== null && typeof row.label !== 'string')) throw new WorkspacePreviewError()
  // leads.name is nullable; never fall back to email, notes, or company data.
  return { id: row.id, label: row.label?.trim() || '—' }
}

async function recentNames(table: 'leads' | 'deals', { siteId, signal }: WorkspacePreviewInput): Promise<WorkspacePreviewRow[]> {
  const query = crmClient().from(table).select('id,label:name').eq('site_id', siteId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PREVIEW_LIMIT)
  return (await readPreviewRows<LabelProjection>(query, signal)).map(previewRow)
}

export function leadsPreview(input: WorkspacePreviewInput): Promise<WorkspacePreviewRow[]> {
  return recentNames('leads', input)
}

export function dealsPreview(input: WorkspacePreviewInput): Promise<WorkspacePreviewRow[]> {
  return recentNames('deals', input)
}

export async function tasksPreview({ siteId, signal }: WorkspacePreviewInput): Promise<WorkspacePreviewRow[]> {
  // The root displays these five Kanban buckets. Take one priority-ordered slice,
  // not five exact counts, task bodies, lead embeds, or assignee lookups.
  const query = crmClient().from('tasks').select('id,label:title').eq('site_id', siteId)
    .in('status', ['pending', 'in_progress', 'completed', 'failed', 'canceled'])
    .order('priority', { ascending: false }).order('scheduled_date', { ascending: true })
    .order('id', { ascending: true }).limit(PREVIEW_LIMIT)
  return (await readPreviewRows<LabelProjection>(query, signal)).map(previewRow)
}