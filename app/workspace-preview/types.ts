export const PREVIEW_LIMIT = 12
export interface WorkspacePreviewInput { siteId: string; actorId: string; signal: AbortSignal }
export interface WorkspacePreviewRow { id: string; label: string; detail?: string }
export type WorkspacePreviewLoader = (scope: WorkspacePreviewInput) => Promise<WorkspacePreviewRow[]>

export class WorkspacePreviewError extends Error {
  constructor(readonly denied = false) { super(denied ? 'Workspace access denied' : 'Preview unavailable') }
}

interface PreviewQuery<T> extends PromiseLike<{
  data: T[] | null; error: { code?: string } | null; status?: number
}> {
  abortSignal(signal: AbortSignal): PreviewQuery<T>
  retry(enabled: boolean): PreviewQuery<T>
}

/** The caller builds a fixed, site-filtered, bounded query with the user client.
 * No automatic retries: contention must not amplify the optional preview. */
export async function readPreviewRows<T>(query: PreviewQuery<T>, signal: AbortSignal): Promise<T[]> {
  if (signal.aborted) throw new WorkspacePreviewError()
  const { data, error, status } = await query.retry(false).abortSignal(signal)
  if (signal.aborted) throw new WorkspacePreviewError()
  if (error || (status && status >= 400)) throw new WorkspacePreviewError(status === 401 || status === 403 ||
    ['42501', 'PGRST301', 'PGRST302', 'PGRST303'].includes(error?.code ?? ''))
  if (!Array.isArray(data) || data.length > PREVIEW_LIMIT) throw new WorkspacePreviewError()
  return data
}