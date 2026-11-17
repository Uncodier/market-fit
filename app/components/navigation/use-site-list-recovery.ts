"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const RETRY_DELAYS = [15_000, 30_000, 60_000]

/** Recover only the absent list, without resetting the selected workspace. */
export function useSiteListRecovery(scope: string | null, refresh: () => Promise<void>) {
  const latest = useRef(refresh)
  useEffect(() => { latest.current = refresh }, [refresh])
  const [pendingScope, setPendingScope] = useState<string | null>(null)
  const run = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    if (!scope) return
    let disposed = false
    let pending = false
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const retry = async () => {
      if (disposed || pending || !navigator.onLine) return
      pending = true
      setPendingScope(scope)
      try { await latest.current() }
      catch { /* The provider owns load errors; recovery cannot fail the workspace. */ }
      finally {
        pending = false
        if (!disposed) setPendingScope(null)
      }
    }
    const schedule = () => {
      if (disposed || attempt >= RETRY_DELAYS.length) return
      timer = setTimeout(async () => {
        attempt += 1
        await retry()
        schedule()
      }, RETRY_DELAYS[attempt])
    }
    const onOnline = () => { void retry() }
    run.current = retry
    window.addEventListener("online", onOnline)
    schedule()
    return () => {
      disposed = true
      clearTimeout(timer)
      run.current = null
      window.removeEventListener("online", onOnline)
    }
  }, [scope])

  const retry = useCallback(() => { void run.current?.() }, [])
  return { retry, isRefreshing: !!scope && pendingScope === scope }
}