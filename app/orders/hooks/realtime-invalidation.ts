export type RealtimeInvalidation = () => unknown | Promise<unknown>

/** One authoritative request plus one dirty follow-up per subscription lifetime. */
export function createRealtimeInvalidation(invalidate: RealtimeInvalidation) {
  let active = true
  let pending = false
  let dirty = false
  let dueAt = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const available = () => document.visibilityState !== "hidden" && navigator.onLine !== false
  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  const schedule = () => {
    clearTimer()
    if (!active || pending || !dirty || !available()) return
    timer = setTimeout(run, Math.max(0, dueAt - Date.now()))
  }
  const settle = (failed: boolean) => {
    pending = false
    if (!active) return
    // Do not spin or retry indefinitely on failure; only retry queued events.
    if (failed && dirty) dueAt = Math.max(dueAt, Date.now() + 1000)
    schedule()
  }
  const failed = () => {
    if (active) console.warn("[realtime] Authoritative refresh failed")
    settle(true)
  }
  function run() {
    timer = undefined
    if (!active || pending || !dirty || !available()) return
    dirty = false
    pending = true
    try {
      const result = invalidate()
      if (result && typeof (result as PromiseLike<unknown>).then === "function") {
        // Retain the slot until the actual query settles, never a timeout.
        void Promise.resolve(result).then(() => settle(false), failed)
      } else {
        settle(false)
      }
    } catch {
      failed()
    }
  }
  document.addEventListener("visibilitychange", schedule)
  window.addEventListener("online", schedule)
  window.addEventListener("offline", schedule)
  return {
    request(delay: number) {
      if (!active) return
      dirty = true
      dueAt = Date.now() + delay
      schedule()
    },
    dispose() {
      active = false
      dirty = false
      clearTimer()
      document.removeEventListener("visibilitychange", schedule)
      window.removeEventListener("online", schedule)
      window.removeEventListener("offline", schedule)
    },
  }
}