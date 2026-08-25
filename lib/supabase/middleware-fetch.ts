/**
 * Edge middleware must return within 25s (Vercel). Auth refresh through
 * Cloudflare can hang ~20s with a 522 and then blow that budget.
 */
export const MIDDLEWARE_FETCH_TIMEOUT_MS = 8_000

type FetchImpl = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

function combineAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([a, b])
  }

  const controller = new AbortController()
  const abort = () => controller.abort()
  if (a.aborted || b.aborted) {
    abort()
    return controller.signal
  }
  a.addEventListener("abort", abort, { once: true })
  b.addEventListener("abort", abort, { once: true })
  return controller.signal
}

function timeoutSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs)
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

export function createMiddlewareFetch(
  timeoutMs: number,
  fetchImpl: FetchImpl = fetch
): FetchImpl {
  return (input, init) => {
    const timeout = timeoutSignal(timeoutMs)
    const signal = init?.signal
      ? combineAbortSignals(init.signal, timeout)
      : timeout
    return fetchImpl(input, { ...init, signal })
  }
}

export const middlewareFetch = createMiddlewareFetch(MIDDLEWARE_FETCH_TIMEOUT_MS)
