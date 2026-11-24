import { useEffect, useMemo, useState } from 'react'

/** Used inside a route/actor/site-keyed form. No persistent or cross-open cache:
 * a late result (even from a non-abortable API) cannot feed the next open. */
export function useDialogRead<T>(siteId: string | null, read: (id: string, signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0)
  const request = useMemo(() => ({ siteId, read, attempt }), [siteId, read, attempt])
  const [result, setResult] = useState<{ request: typeof request; data?: T; failed: boolean } | null>(null)
  useEffect(() => {
    if (!request.siteId) return
    const controller = new AbortController()
    void request.read(request.siteId, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ request, data, failed: false })
    }, () => {
      if (!controller.signal.aborted) setResult({ request, failed: true })
    })
    return () => controller.abort()
  }, [request])
  const current = result?.request === request ? result : null
  return {
    data: current?.data,
    failed: current?.failed ?? false,
    retry: () => setAttempt(n => n + 1),
  }
}