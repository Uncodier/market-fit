import {
  acquireSemaphoreResult,
  hashRedisKeyPart,
  releaseSemaphore,
  renewSemaphore,
} from "@/lib/redis/control-plane"
import { isRedisConfigured } from "@/lib/redis/upstash-rest"

export type OperationLease = {
  renew: () => Promise<boolean>
  release: () => Promise<void>
}

export type OperationLeaseResult =
  | { status: "acquired"; lease: OperationLease }
  | { status: "contended" | "unavailable" }

async function releaseOwner(key: string, ownerToken: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await releaseSemaphore(key, ownerToken)) return
  }
  // Do not include resource IDs, owner tokens, or provider error payloads.
  console.warn("Operation lease release was not confirmed; ownership will expire")
}

export async function acquireOperationLease(
  operation: string,
  resourceId: string,
  ttlMs: number,
  limit = 1,
): Promise<OperationLease | null> {
  const result = await acquireOperationLeaseResult(operation, resourceId, ttlMs, limit)
  return result.status === "acquired" ? result.lease : null
}

export async function acquireOperationLeaseResult(
  operation: string,
  resourceId: string,
  ttlMs: number,
  limit = 1,
  options: { renewAutomatically?: boolean } = {},
): Promise<OperationLeaseResult> {
  if (!isRedisConfigured()) {
    if (process.env.REDIS_REQUIRED === "true" || process.env.REDIS_URL?.trim()) {
      return { status: "unavailable" }
    }
    return { status: "acquired", lease: {
      renew: async () => true,
      release: async () => undefined,
    } }
  }

  const resourceHash = await hashRedisKeyPart(resourceId)
  const key = `sem:v1:${operation}:${resourceHash}`
  const ownerToken = crypto.randomUUID()
  const status = await acquireSemaphoreResult(key, ownerToken, limit, ttlMs)
  if (status !== "acquired") {
    // A lost acquisition acknowledgement may still have inserted our token.
    // No work has started, so remove only this request's owner, never another's.
    if (status === "unavailable") await releaseOwner(key, ownerToken)
    return { status }
  }

  let released = false
  let releasePromise: Promise<void> | undefined
  const heartbeat = options.renewAutomatically === false ? undefined : setInterval(() => {
    if (!released) void renewSemaphore(key, ownerToken, ttlMs).then((renewed) => {
      if (!renewed) console.warn("Operation lease renewal was not confirmed")
    })
  }, Math.max(1_000, Math.floor(ttlMs / 3)))

  return { status: "acquired", lease: {
    renew: () => released ? Promise.resolve(false) : renewSemaphore(key, ownerToken, ttlMs),
    release: () => {
      if (releasePromise) return releasePromise
      released = true
      clearInterval(heartbeat)
      releasePromise = releaseOwner(key, ownerToken)
      return releasePromise
    },
  } }
}

export function releaseLeasesWithStream(
  body: ReadableStream<Uint8Array> | null,
  leases: OperationLease[],
  options: { signal?: AbortSignal; maxDurationMs?: number; onClose?: () => void } = {},
): ReadableStream<Uint8Array> | null {
  let releasePromise: Promise<unknown> | undefined
  const releaseAll = () => {
    releasePromise ??= Promise.allSettled(leases.map((lease) => lease.release()))
    return releasePromise
  }
  if (!body) {
    options.onClose?.()
    void releaseAll()
    return null
  }

  const reader = body.getReader()
  let finished = false
  let deadline: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined
  const finish = () => {
    finished = true
    clearTimeout(deadline)
    if (onAbort) options.signal?.removeEventListener("abort", onAbort)
    options.onClose?.()
    return releaseAll()
  }
  const cancelReader = (reason?: unknown) => {
    // Cancellation can hang in the upstream transport. Never keep renewing a
    // lease while waiting for it; cancelling the response does not cancel work.
    void reader.cancel(reason).catch(() => {}).finally(() => reader.releaseLock())
  }
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const abort = (reason: unknown) => {
        if (finished) return
        void finish()
        controller.error(reason)
        cancelReader(reason)
      }
      onAbort = () => abort(options.signal?.reason ?? new Error("Response disconnected"))
      if (options.signal?.aborted) { onAbort(); return }
      options.signal?.addEventListener("abort", onAbort, { once: true })
      if (options.maxDurationMs !== undefined) {
        deadline = setTimeout(() => abort(new Error("Response stream timed out")), options.maxDurationMs)
      }
    },
    async pull(controller) {
      try {
        const result = await reader.read()
        if (finished) return
        if (result.done) {
          await finish()
          reader.releaseLock()
          controller.close()
          return
        }
        controller.enqueue(result.value)
      } catch (error) {
        if (finished) return
        await finish()
        controller.error(error)
        cancelReader(error)
      }
    },
    async cancel(reason) {
      if (finished) return
      const released = finish()
      cancelReader(reason)
      await released
    },
  })
}
