import {
  acquireSemaphore,
  hashRedisKeyPart,
  releaseSemaphore,
  renewSemaphore,
} from "@/lib/redis/control-plane"
import { isRedisConfigured } from "@/lib/redis/upstash-rest"

export type OperationLease = {
  renew: () => Promise<boolean>
  release: () => Promise<void>
}

export async function acquireOperationLease(
  operation: string,
  resourceId: string,
  ttlMs: number,
  limit = 1,
): Promise<OperationLease | null> {
  if (!isRedisConfigured()) {
    if (process.env.REDIS_REQUIRED === "true") return null
    return {
      renew: async () => true,
      release: async () => undefined,
    }
  }

  const resourceHash = await hashRedisKeyPart(resourceId)
  const key = `sem:v1:${operation}:${resourceHash}`
  const ownerToken = crypto.randomUUID()
  const acquired = await acquireSemaphore(key, ownerToken, limit, ttlMs)
  if (!acquired) return null

  let released = false
  const heartbeat = setInterval(() => {
    if (!released) void renewSemaphore(key, ownerToken, ttlMs)
  }, Math.max(1_000, Math.floor(ttlMs / 3)))

  return {
    renew: () => renewSemaphore(key, ownerToken, ttlMs),
    release: async () => {
      if (released) return
      released = true
      clearInterval(heartbeat)
      await releaseSemaphore(key, ownerToken)
    },
  }
}

export function releaseLeasesWithStream(
  body: ReadableStream<Uint8Array> | null,
  leases: OperationLease[],
): ReadableStream<Uint8Array> | null {
  const releaseAll = async () => {
    await Promise.allSettled(leases.map((lease) => lease.release()))
  }
  if (!body) {
    void releaseAll()
    return null
  }

  const reader = body.getReader()
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await reader.read()
        if (result.done) {
          controller.close()
          await releaseAll()
          return
        }
        controller.enqueue(result.value)
      } catch (error) {
        controller.error(error)
        await releaseAll()
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason)
      } finally {
        await releaseAll()
      }
    },
  })
}
