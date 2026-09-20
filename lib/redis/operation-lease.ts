import {
  acquireSemaphore,
  hashRedisKeyPart,
  releaseSemaphore,
} from "@/lib/redis/control-plane"
import { isRedisConfigured } from "@/lib/redis/upstash-rest"

export type OperationLease = {
  release: () => Promise<void>
}

export async function acquireOperationLease(
  operation: string,
  resourceId: string,
  ttlMs: number
): Promise<OperationLease | null> {
  if (!isRedisConfigured()) {
    return { release: async () => undefined }
  }

  const resourceHash = await hashRedisKeyPart(resourceId)
  const key = `sem:v1:${operation}:${resourceHash}`
  const ownerToken = crypto.randomUUID()
  const acquired = await acquireSemaphore(key, ownerToken, 1, ttlMs)
  if (!acquired) return null

  return {
    release: () => releaseSemaphore(key, ownerToken),
  }
}
