import { NextResponse } from "next/server"
import { executeRedisCommand } from "@/lib/redis/upstash-rest"

type FailureMode = "open" | "closed"

export type RateLimitPolicy = {
  limit: number
  windowSeconds: number
  failureMode: FailureMode
}

export type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetMs: number
  unavailable?: boolean
}

const RATE_LIMIT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { current, ttl }
`

const RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`

const ACQUIRE_SEMAPHORE_SCRIPT = `
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", ARGV[1])
redis.call("ZADD", KEYS[1], "NX", ARGV[2], ARGV[3])
local count = redis.call("ZCARD", KEYS[1])
if count > tonumber(ARGV[4]) then
  redis.call("ZREM", KEYS[1], ARGV[3])
  return { 0, count - 1 }
end
redis.call("PEXPIRE", KEYS[1], ARGV[5])
return { 1, count }
`

export async function hashRedisKeyPart(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export async function checkRateLimit(
  key: string,
  policy: RateLimitPolicy
): Promise<RateLimitResult> {
  const windowMs = policy.windowSeconds * 1000
  const response = await executeRedisCommand<[number, number]>([
    "EVAL",
    RATE_LIMIT_SCRIPT,
    1,
    key,
    windowMs,
  ])

  if (!response.configured || response.error || !response.result) {
    return {
      allowed: policy.failureMode === "open",
      limit: policy.limit,
      remaining: policy.failureMode === "open" ? policy.limit : 0,
      resetMs: windowMs,
      unavailable: true,
    }
  }

  const [count, ttl] = response.result.map(Number)
  return {
    allowed: count <= policy.limit,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - count),
    resetMs: Math.max(0, ttl),
  }
}

export function rateLimitError(result: RateLimitResult): NextResponse {
  const retryAfter = Math.max(1, Math.ceil(result.resetMs / 1000))
  return NextResponse.json(
    {
      error: result.unavailable
        ? "Request admission is temporarily unavailable"
        : "Too many requests",
    },
    {
      status: result.unavailable ? 503 : 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(
          Math.ceil((Date.now() + result.resetMs) / 1000)
        ),
      },
    }
  )
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const response = await executeRedisCommand<string | null>(["GET", key])
  if (!response.configured || response.error || !response.result) return null
  try {
    return JSON.parse(response.result) as T
  } catch {
    return null
  }
}

export async function setCachedJson(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<boolean> {
  const response = await executeRedisCommand<string>([
    "SET",
    key,
    JSON.stringify(value),
    "EX",
    ttlSeconds,
  ])
  return response.configured && !response.error && response.result === "OK"
}

export async function acquireLock(
  key: string,
  ownerToken: string,
  ttlMs: number
): Promise<boolean> {
  const response = await executeRedisCommand<string | null>([
    "SET",
    key,
    ownerToken,
    "NX",
    "PX",
    ttlMs,
  ])
  return response.configured && !response.error && response.result === "OK"
}

export async function releaseLock(
  key: string,
  ownerToken: string
): Promise<boolean> {
  const response = await executeRedisCommand<number>([
    "EVAL",
    RELEASE_LOCK_SCRIPT,
    1,
    key,
    ownerToken,
  ])
  return response.configured && !response.error && response.result === 1
}

export async function acquireSemaphore(
  key: string,
  ownerToken: string,
  limit: number,
  ttlMs: number
): Promise<boolean> {
  const now = Date.now()
  const response = await executeRedisCommand<[number, number]>([
    "EVAL",
    ACQUIRE_SEMAPHORE_SCRIPT,
    1,
    key,
    now,
    now + ttlMs,
    ownerToken,
    limit,
    ttlMs,
  ])
  return (
    response.configured &&
    !response.error &&
    Number(response.result?.[0]) === 1
  )
}

export async function releaseSemaphore(
  key: string,
  ownerToken: string
): Promise<void> {
  await executeRedisCommand(["ZREM", key, ownerToken])
}
