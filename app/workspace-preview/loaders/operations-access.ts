import { createClient } from '@/lib/supabase/client'
import { readPreviewAuth } from './preview-auth'
import { WorkspacePreviewError, type WorkspacePreviewInput, type WorkspacePreviewRow } from '@/app/workspace-preview/types'

const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

// These are browser reads for an already verified screen, not a membership or
// action grant. Never read simulated data on a stale demo switch or env error.
export function operationsClient({ siteId, actorId, signal }: WorkspacePreviewInput) {
  if (signal.aborted || !uuid.test(siteId) || !uuid.test(actorId)) throw new WorkspacePreviewError()
  const db = createClient()
  if (db._isMock || db._isDemo) throw new WorkspacePreviewError()
  return db
}

type Client = ReturnType<typeof operationsClient>

export async function authenticatedOperationsClient(input: WorkspacePreviewInput) {
  const db = operationsClient(input)
  const { data, error } = await readPreviewAuth(input.signal, () => db.auth.getUser())
  if (input.signal.aborted) throw new WorkspacePreviewError()
  if (error) throw new WorkspacePreviewError(error.status === 401 || error.status === 403 || error.name === 'AuthSessionMissingError')
  if (!data?.user || data.user.is_anonymous || data.user.id !== input.actorId) throw new WorkspacePreviewError(true)
  return db
}

// No SDK retries for a speculative admission read. A failed or malformed
// result must never start a data query or appear to be an empty list.
export async function readAdmission(
  query: { retry(enabled: boolean): { abortSignal(signal: AbortSignal): PromiseLike<{
    data: unknown; error: { code?: string } | null; status?: number
  }> } }, signal: AbortSignal,
): Promise<unknown> {
  if (signal.aborted) throw new WorkspacePreviewError()
  const { data, error, status } = await query.retry(false).abortSignal(signal)
  if (signal.aborted) throw new WorkspacePreviewError()
  if (error || (status && status >= 400)) throw new WorkspacePreviewError(status === 401 || status === 403 || error?.code === '42501')
  return data
}

export async function requireSiteRole(db: Client, { siteId, signal }: WorkspacePreviewInput) {
  const role = await readAdmission(db.rpc('current_user_site_role', { p_site_id: siteId }, { get: true }), signal)
  if (role === null) throw new WorkspacePreviewError(true)
  if (role !== 'owner' && role !== 'admin' && role !== 'collaborator' && role !== 'marketing') throw new WorkspacePreviewError()
}

export async function requireSelect(db: Client, { siteId, signal }: WorkspacePreviewInput) {
  const allowed = await readAdmission(db.rpc('user_can', { p_site_id: siteId, p_command: 'select' }, { get: true }), signal)
  if (allowed !== true) throw new WorkspacePreviewError(allowed === false)
}

export function previewRow(id: string, label: string | null, detail?: string | null): WorkspacePreviewRow {
  if (typeof id !== 'string' || !id.trim() || (label !== null && typeof label !== 'string') ||
      (detail != null && typeof detail !== 'string')) throw new WorkspacePreviewError()
  return { id, label: label?.trim() || '—', ...(detail ? { detail } : {}) }
}