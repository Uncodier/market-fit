/** One wall-clock budget for auth and screen lookups on the same request. */
export const MIDDLEWARE_OPERATION_TIMEOUT_MS = 8_000

// Keep only a timestamp between operations, not a timer, client, or request closure.
// A new operation must not reset the budget after a successful auth lookup.
const requestDeadlines = new WeakMap<object, number>()

export class MiddlewareDeadline {
  private readonly controller = new AbortController()
  private readonly timer: ReturnType<typeof setTimeout> | undefined
  private readonly detachRequest: () => void

  constructor(private readonly expiresAt: number, requestSignal?: AbortSignal) {
    const cancel = () => this.close(requestSignal?.reason)
    this.detachRequest = () => requestSignal?.removeEventListener('abort', cancel)
    if (requestSignal?.aborted) {
      cancel()
    } else if (expiresAt <= Date.now()) {
      this.expire()
    } else {
      requestSignal?.addEventListener('abort', cancel, { once: true })
      this.timer = setTimeout(() => this.expire(), expiresAt - Date.now())
    }
  }

  get signal(): AbortSignal {
    return this.controller.signal
  }

  get active(): boolean {
    if (!this.signal.aborted && Date.now() >= this.expiresAt) this.expire()
    return !this.signal.aborted
  }

  assertActive(): void {
    if (!this.active) throw this.signal.reason
  }

  /**
   * Observe all settlements, including transports/SDK locks that ignore abort.
   * The caller must use this same scope for transport and cookie writes, then
   * dispose it in finally. Returning early alone would leave live SDK retries.
   */
  wait<T>(work: () => T | PromiseLike<T>, signal = this.signal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const abort = () => {
        cleanup()
        reject(signal.reason)
      }
      const cleanup = () => signal.removeEventListener('abort', abort)
      try {
        this.assertActive()
        if (signal.aborted) throw signal.reason
        signal.addEventListener('abort', abort, { once: true })
        Promise.resolve(work()).then(
          (value) => {
            cleanup()
            try {
              this.assertActive()
              if (signal.aborted) throw signal.reason
              resolve(value)
            } catch (error) {
              reject(error)
            }
          },
          (error: unknown) => {
            cleanup()
            reject(this.active ? (signal.aborted ? signal.reason : error) : this.signal.reason)
          }
        )
      } catch (error) {
        cleanup()
        reject(this.active ? (signal.aborted ? signal.reason : error) : this.signal.reason)
      }
    })
  }

  dispose(): void {
    this.close(new DOMException('Middleware operation disposed', 'AbortError'))
  }

  private expire(): void {
    this.close(new DOMException('Middleware operation deadline exceeded', 'TimeoutError'))
  }

  private close(reason: unknown): void {
    clearTimeout(this.timer)
    this.detachRequest()
    if (!this.signal.aborted) this.controller.abort(reason)
  }
}

export function createMiddlewareDeadline(
  request: { signal?: AbortSignal },
  timeoutMs = MIDDLEWARE_OPERATION_TIMEOUT_MS
): MiddlewareDeadline {
  let expiresAt = requestDeadlines.get(request)
  if (expiresAt === undefined) {
    expiresAt = Date.now() + timeoutMs
    requestDeadlines.set(request, expiresAt)
  }
  return new MiddlewareDeadline(expiresAt, request.signal)
}