import { createClient } from '@/lib/supabase/client'
import { readPreviewAuth } from './preview-auth'
import { PREVIEW_LIMIT, WorkspacePreviewError, type WorkspacePreviewInput } from '../types'

/** Do not substitute a quotations table scan for the normal seller/buyer
 * projection. The RPC enforces distinct visibility for procurement proposals. */
export async function quotationsPreview({ siteId, actorId, signal }: WorkspacePreviewInput) {
  const client = createClient()
  if (signal.aborted || client._isMock || client._isDemo) throw new WorkspacePreviewError()
  const auth = await readPreviewAuth(signal, () => client.auth.getUser())
  if (signal.aborted) throw new WorkspacePreviewError()
  if (auth.error) throw new WorkspacePreviewError(auth.error.status === 401 || auth.error.status === 403)
  if (!auth.data.user || auth.data.user.id !== actorId || auth.data.user.is_anonymous) throw new WorkspacePreviewError(true)
  const response = await client.rpc('list_workspace_quotations', { p_site: siteId, p_status: 'all', p_search: '',
    p_page: 1, p_page_size: PREVIEW_LIMIT, p_sort: 'newest' }, { get: true }).retry(false).abortSignal(signal)
  if (signal.aborted || response.error || !Array.isArray(response.data?.data) || response.data.data.length > PREVIEW_LIMIT) {
    throw new WorkspacePreviewError(response.status === 401 || response.status === 403 || response.error?.code === '42501')
  }
  return response.data.data.map((row: { id?: unknown; title?: unknown }) => {
    if (!row || typeof row.id !== 'string' || !row.id || (row.title != null && typeof row.title !== 'string')) throw new WorkspacePreviewError()
    return { id: row.id, label: (typeof row.title === 'string' && row.title.trim()) || `#${row.id.slice(0, 8)}` }
  })
}