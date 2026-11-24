import { isTerminalRequestError } from '@/lib/swr/retry-policy'

/** PostgREST returns HTTP status on the response, not necessarily on its error. */
export function conversationReadError(error: unknown, status?: number): Error & { status: number } {
  const details = error && typeof error === 'object' ? error as { code?: string; status?: number } : {}
  const http = Number(status || details.status)
  const denied = details.code === '42501' || details.code === 'PT403'
  const unauthenticated = ['PGRST301', 'PGRST302', 'PGRST303', 'PT401'].includes(details.code ?? '')
  // PostgREST can map a transient SQL timeout/lock failure to HTTP 400.
  const temporary = ['57014', '55P03', '40001', '40P01', '53300'].includes(details.code ?? '')
  const safeStatus = denied ? 403 : unauthenticated ? 401 : temporary && http !== 401 && http !== 403 ? 503
    : http >= 400 && http <= 599 ? http
    : isTerminalRequestError(error) ? 403 : 503
  return Object.assign(new Error('Unable to load conversations'), { status: safeStatus })
}

interface ConversationQuery<T> extends PromiseLike<{ data: T | null; error: unknown; status?: number; count?: number | null }> {
  abortSignal?: (signal: AbortSignal) => ConversationQuery<T>
  retry?: (enabled: boolean) => ConversationQuery<T>
}

export function prepareConversationQuery<T>(query: ConversationQuery<T>, signal?: AbortSignal) {
  if (signal?.aborted) throw conversationReadError(null, 408)
  // The SDK retries network failures by default, but the list exposes an explicit
  // Retry action. Demo builders are lazy proxies and don't implement SDK retry.
  const once = 'retry' in query && query.retry ? query.retry(false) : query
  return signal && once.abortSignal ? once.abortSignal(signal) : once
}

export async function readConversationQuery<T>(query: ConversationQuery<T>, signal?: AbortSignal): Promise<T | null> {
  const response = await prepareConversationQuery(query, signal)
  if (response.error) throw conversationReadError(response.error, response.status)
  if (signal?.aborted) throw conversationReadError(null, 408)
  return response.data
}