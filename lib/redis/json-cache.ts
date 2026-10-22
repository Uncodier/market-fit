import {
  acquireLock,
  getCachedJson,
  hashRedisKeyPart,
  releaseLock,
  setCachedJson,
} from "@/lib/redis/control-plane"
import {
  executeRedisCommand,
  isRedisConfigured,
} from "@/lib/redis/upstash-rest"

type CacheResult<T> =
  | { status: "hit" | "stale" | "computed"; value: T }
  | { status: "busy" }

type CacheOptions<T> = {
  key: string
  ttlSeconds: number
  lockTtlMs?: number
  compute: () => Promise<T>
}

// Pending work only: callers must authorize before using their final scoped key.
// Do not evict running entries, which would permit duplicate computations.
const inflight = new Map<string, Promise<CacheResult<unknown>>>()

function callerResult<T>(pending: Promise<CacheResult<T>>): Promise<CacheResult<T>> {
  return pending.then(result => {
    if (result.status === "busy") return { status: "busy" }
    // Share pending work, not mutable JSON values between authorized callers.
    return { status: result.status, value: structuredClone(result.value) }
  })
}

const BUMP_CACHE_EPOCH_SCRIPT = `
local value = redis.call("INCR", KEYS[1])
redis.call("EXPIRE", KEYS[1], ARGV[1])
return value
`

export async function normalizedRequestCacheKey(
  namespace: string,
  request: Request
): Promise<string> {
  const url = new URL(request.url)
  const normalized = Array.from(url.searchParams.entries())
    .filter(([key]) => key !== "userId")
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      `${leftKey}=${leftValue}`.localeCompare(`${rightKey}=${rightValue}`)
    )
  const digest = await hashRedisKeyPart(
    `${namespace}:${new URLSearchParams(normalized).toString()}`
  )
  return `cache:v1:${namespace}:${digest}`
}

export function readThroughJsonCache<T>(
  options: CacheOptions<T>
): Promise<CacheResult<T>> {
  const key = options.key
  const pending = inflight.get(key)
  if (pending) return callerResult(pending as Promise<CacheResult<T>>)
  const operationOptions = { ...options, key }

  // Register synchronously, before configuration, reads, or compute can run.
  const operation = Promise.resolve()
    .then(() => readJsonCache(operationOptions))
    .finally(() => { inflight.delete(key) })
  inflight.set(key, operation)
  return callerResult(operation)
}

async function readJsonCache<T>(options: CacheOptions<T>): Promise<CacheResult<T>> {
  if (!isRedisConfigured()) {
    return { status: "computed", value: await options.compute() }
  }

  const fresh = await getCachedJson<T>(options.key)
  if (fresh !== null) return { status: "hit", value: fresh }

  const lockKey = `lock:${options.key}`
  const ownerToken = crypto.randomUUID()
  const acquired = await acquireLock(
    lockKey,
    ownerToken,
    options.lockTtlMs ?? 15_000
  )

  if (!acquired) {
    const stale = await getCachedJson<T>(`${options.key}:stale`)
    if (stale !== null) return { status: "stale", value: stale }
    // Lock failures and contention both return false; neither permits bypass.
    return { status: "busy" }
  }

  try {
    const value = await options.compute()
    const writes = await Promise.allSettled([
      setCachedJson(options.key, value, options.ttlSeconds),
      setCachedJson(`${options.key}:stale`, value, options.ttlSeconds * 5),
    ])
    for (const write of writes) {
      if (write.status === "rejected") throw write.reason
    }
    return { status: "computed", value }
  } finally {
    await releaseLock(lockKey, ownerToken)
  }
}

export async function readCacheEpoch(namespace: string, scope: string) {
  if (!isRedisConfigured()) return "0"
  const scopeHash = await hashRedisKeyPart(scope)
  const value = await getCachedJson<number>(
    `cache-epoch:v1:${namespace}:${scopeHash}`,
  )
  return String(value ?? 0)
}

export async function bumpCacheEpoch(
  namespace: string,
  scope: string,
): Promise<boolean> {
  if (!isRedisConfigured()) return true
  const scopeHash = await hashRedisKeyPart(scope)
  const response = await executeRedisCommand<number>([
    "EVAL",
    BUMP_CACHE_EPOCH_SCRIPT,
    1,
    `cache-epoch:v1:${namespace}:${scopeHash}`,
    30 * 24 * 60 * 60,
  ])
  return response.configured && !response.error
}
