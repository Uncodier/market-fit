import { createClient } from '@/lib/supabase/client'
import { PREVIEW_LIMIT, readPreviewRows, WorkspacePreviewError, type WorkspacePreviewInput } from '../types'

// Only verified roots whose normal index exposes these same rows under user RLS.
// Fixed sources and predicates: never accept a table, field or target from a URL.
const directories = {
  campaigns: { table: 'campaigns', label: 'title' },
  segments: { table: 'segments', label: 'name' },
  assets: { table: 'assets', label: 'name' },
  content: { table: 'content', label: 'title' },
  promotions: { table: 'promotions', label: 'name' },
  catalog: { table: 'catalog_items', label: 'name' },
  priceLists: { table: 'price_lists', label: 'name' },
  modifierGroups: { table: 'modifier_groups', label: 'name' },
  requirements: { table: 'requirements', label: 'title' },
  records: { table: 'record_categories', label: 'name' },
  agentsConfiguration: { table: 'agents', label: 'name' },
} as const

export type DirectoryScreen = keyof typeof directories

export async function directoryPreview(screen: DirectoryScreen, { siteId, signal }: WorkspacePreviewInput) {
  const { table, label } = directories[screen]
  const client = createClient()
  if (client._isMock || client._isDemo || signal.aborted) throw new WorkspacePreviewError()
  let query = client.from(table).select(`id, label:${label}`).eq('site_id', siteId)
  if (screen === 'catalog') query = query.eq('status', 'active').order('sort_order', { ascending: true })
  if (screen === 'modifierGroups') query = query.order('sort_order', { ascending: true }).order('name', { ascending: true })
  else query = query.order('created_at', { ascending: screen === 'records' || screen === 'agentsConfiguration' })
  const rows = await readPreviewRows<{ id: string; label: string | null }>(query.order('id', { ascending: true }).limit(PREVIEW_LIMIT), signal)
  return rows.map(row => {
    if (!row || typeof row.id !== 'string' || !row.id || (row.label !== null && typeof row.label !== 'string')) throw new WorkspacePreviewError()
    return { id: row.id, label: row.label?.trim() || '—' }
  })
}