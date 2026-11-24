import { snapshotPostgrestError } from '@/lib/supabase/postgrest-error'

const COUNTED_READ_TIMEOUT_MS = 5_000
const LIST_READ_TIMEOUT_MS = 5_000

type LeadReadResult<T> = {
  data: T[] | null
  count: number | null
  status: number
  error: { code: string } | null
}

type LeadQuery<T> = PromiseLike<LeadReadResult<T>> & {
  abortSignal(signal: AbortSignal): LeadQuery<T>
  retry?(enabled: boolean): LeadQuery<T>
}

type ReadResult<T> = LeadReadResult<T> & { timeout: boolean }

async function readOnce<T>(query: LeadQuery<T>, timeoutMs: number, isDemo: boolean): Promise<ReadResult<T>> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    // The lazy demo proxy supports abortSignal, but it is not a PostgREST SDK.
    const transport = isDemo ? query : query.retry?.(false) ?? query
    const response = Promise.resolve(transport.abortSignal(controller.signal)).then(result => ({
      ...result,
      timeout: !!result.error && result.status !== 401 && result.status !== 403 &&
        (result.error.code === '57014' || (result.status === 504 && result.error.code !== 'PGRST003')),
    }))
    const deadline = new Promise<ReadResult<T>>(resolve => {
      timer = setTimeout(() => {
        resolve({ data: null, count: null, status: 504, timeout: true, error: { code: 'LEAD_READ_TIMEOUT' } })
        controller.abort()
      }, timeoutMs)
    })
    // Also bound waiting for the client SDK, even if it does not settle on abort.
    return await Promise.race([response, deadline])
  } finally {
    clearTimeout(timer)
  }
}

/** Keep the fast path to one GET. Rebuild (do not reuse) the failed count query. */
export async function readWithOptionalCount<T>(build: (withCount: boolean) => LeadQuery<T>, isDemo = false) {
  const counted = await readOnce(build(true), COUNTED_READ_TIMEOUT_MS, isDemo)
  if (!counted.timeout) return counted

  console.warn('Leads count request timed out; retrying without an exact total')
  const page = await readOnce(build(false), LIST_READ_TIMEOUT_MS, isDemo)
  return { ...page, count: null }
}

export function exactLeadCount(count: unknown): number | null {
  return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : null
}

export function leadReadFailure(error: unknown, status = 0) {
  const { code } = snapshotPostgrestError(error)
  if (status === 401 || ['PGRST301', 'PGRST302', 'PGRST303'].includes(code)) {
    return { error: 'Not authenticated' }
  }
  if (status === 403 || code === '42501') return { error: 'Forbidden' }
  // Keep diagnostics useful without logging row contents or raw upstream bodies.
  console.error('Leads read failed', { status, code: code === 'LEAD_READ_TIMEOUT' || /^[A-Z0-9]{5,9}$/.test(code) ? code : undefined })
  return { error: 'Error loading leads' }
}