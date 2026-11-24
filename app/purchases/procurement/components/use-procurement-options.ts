import { useEffect, useState } from 'react'

/** One read per active picker/editor. No shared cache, background refresh or mutation retries. */
export function useProcurementOptions<T>(url: string | null, read: (url: string, signal: AbortSignal) => Promise<T>, delay = 0) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ url: string | null; attempt: number; data?: T; error?: string }>({ url, attempt })
  // Drop prior choices during render, including when a picker closes or a query is retried.
  if (result.url !== url || result.attempt !== attempt) setResult({ url, attempt })

  useEffect(() => {
    if (!url) return
    const controller = new AbortController()
    const load = async () => {
      try {
        const data = await read(url, controller.signal)
        if (!controller.signal.aborted) setResult({ url, attempt, data })
      } catch (failure) {
        if (!controller.signal.aborted) setResult({ url, attempt, error: failure instanceof Error && failure.message ? failure.message : 'Could not load choices.' })
      }
    }
    const timer = delay ? setTimeout(load, delay) : undefined
    if (!delay) void load()
    return () => { clearTimeout(timer); controller.abort() }
  }, [url, attempt, read, delay])

  return { data: result.data, error: result.error, loading: !!url && result.data === undefined && !result.error, retry: () => setAttempt(n => n + 1) }
}