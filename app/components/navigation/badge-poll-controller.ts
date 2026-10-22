export interface BadgePollOptions {
  query: (signal: AbortSignal) => Promise<number>
  onValue: (value: number) => void
  intervalMs: number
  timeoutMs: number
}

type Flight = {
  controller: AbortController
  timeout: ReturnType<typeof setTimeout> | undefined
  reason?: "pause" | "timeout" | "cleanup"
}

/** One slot per mounted badge, retained across effect/key changes and aborts. */
export class BadgePollController {
  private options: BadgePollOptions | null = null
  private flight: Flight | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private failures = 0
  private nextAt = 0

  start(options: BadgePollOptions): () => void {
    this.stop()
    this.options = options
    this.failures = 0
    this.nextAt = 0
    document.addEventListener("visibilitychange", this.reconcile)
    window.addEventListener("online", this.reconcile)
    window.addEventListener("offline", this.reconcile)
    this.reconcile()
    return () => {
      if (this.options === options) this.stop()
    }
  }

  private clearTimer(): void {
    clearTimeout(this.timer)
    this.timer = undefined
  }

  private abort(reason: Flight["reason"]): void {
    if (!this.flight) return
    this.flight.reason ??= reason
    clearTimeout(this.flight.timeout)
    this.flight.timeout = undefined
    this.flight.controller.abort()
    // Abort is only a request. Never release the slot before actual settlement.
  }

  private stop(): void {
    this.options = null
    this.clearTimer()
    this.abort("cleanup")
    document.removeEventListener("visibilitychange", this.reconcile)
    window.removeEventListener("online", this.reconcile)
    window.removeEventListener("offline", this.reconcile)
  }

  private reconcile = (): void => {
    this.clearTimer()
    if (!this.options) return
    if (document.visibilityState !== "visible" || !navigator.onLine) {
      this.abort("pause")
      return
    }
    if (this.flight) return
    const delay = this.nextAt - Date.now()
    if (delay > 0) {
      this.timer = setTimeout(this.reconcile, delay)
    } else {
      void this.poll(this.options)
    }
  }

  private async poll(options: BadgePollOptions): Promise<void> {
    const flight: Flight = { controller: new AbortController(), timeout: undefined }
    this.flight = flight
    flight.timeout = setTimeout(() => this.abort("timeout"), options.timeoutMs)
    let failed = false
    try {
      const value = await options.query(flight.controller.signal)
      if (this.options === options && !flight.controller.signal.aborted) {
        options.onValue(value)
      }
    } catch {
      failed = true
    } finally {
      clearTimeout(flight.timeout)
      this.flight = null
      if (this.options === options) {
        if (flight.reason === "pause") {
          this.nextAt = Date.now()
        } else if (failed || flight.reason === "timeout") {
          options.onValue(0)
          this.failures = Math.min(this.failures + 1, 6)
          // 80–100% jitter, exponential from 2x cadence, capped at five minutes.
          const ceiling = Math.min(300_000, options.intervalMs * 2 ** this.failures)
          this.nextAt = Date.now() + Math.floor(ceiling * (0.8 + Math.random() * 0.2))
        } else {
          this.failures = 0
          this.nextAt = Date.now() + options.intervalMs
        }
      }
      this.reconcile()
    }
  }
}