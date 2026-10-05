import type { MiddlewareDeadline } from '@/lib/supabase/middleware-deadline'

type FetchImpl = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

function combineAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController()
  const abort = () => {
    a.removeEventListener('abort', abort)
    b.removeEventListener('abort', abort)
    controller.abort(a.aborted ? a.reason : b.reason)
  }
  if (a.aborted || b.aborted) abort()
  else {
    a.addEventListener('abort', abort, { once: true })
    b.addEventListener('abort', abort, { once: true })
  }
  // Keep the scope linked after headers arrive: response body reads also need
  // cancellation. Disposing the operation removes both listeners.
  return controller.signal
}

export function createMiddlewareFetch(
  deadline: MiddlewareDeadline,
  fetchImpl: FetchImpl = fetch
): FetchImpl {
  return (input, init) => {
    const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
    const signal = callerSignal && callerSignal !== deadline.signal
      ? combineAbortSignals(deadline.signal, callerSignal)
      : deadline.signal
    // Auth-js retries even AbortError as AuthRetryableFetchError (status 0).
    // Check before invoking the transport so disposed SDK retries cannot send.
    return deadline.wait(() => fetchImpl(input, { ...init, signal }), signal)
  }
}
