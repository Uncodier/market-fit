/** Bound browser waits without relying on AbortSignal.any/timeout support. Never retry mutations. */
export async function openRouterRequest(url: string, init: RequestInit = {}, timeoutMs = 35_000): Promise<Response> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (init.signal?.aborted) controller.abort()
  else init.signal?.addEventListener("abort", abort, { once: true })
  const timeout = setTimeout(abort, timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
    init.signal?.removeEventListener("abort", abort)
  }
}