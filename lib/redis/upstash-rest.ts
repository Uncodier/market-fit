const DEFAULT_TIMEOUT_MS = 800

export type RedisCommandResult<T> =
  | { configured: false; result?: undefined; error?: undefined }
  | { configured: true; result: T; error?: undefined }
  | { configured: true; result?: undefined; error: string }

type RedisConfiguration =
  | { url: string; token: string; error?: undefined }
  | { url?: undefined; token?: undefined; error: string }

function configuration(): RedisConfiguration | null {
  const rawUrl = process.env.REDIS_URL?.trim()
  if (!rawUrl) return null

  try {
    const parsed = new URL(rawUrl)
    const token = decodeURIComponent(parsed.password || parsed.username).trim()
    if (!token) {
      return { error: "REDIS_URL must include authentication credentials" }
    }

    if (parsed.protocol === "redis:" || parsed.protocol === "rediss:") {
      if (!parsed.hostname.endsWith(".upstash.io")) {
        return {
          error: "Redis TCP URLs require an Upstash endpoint for REST access",
        }
      }
      return { url: `https://${parsed.hostname}`, token }
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { error: "REDIS_URL uses an unsupported protocol" }
    }

    parsed.username = ""
    parsed.password = ""
    parsed.hash = ""
    parsed.search = ""
    return { url: parsed.toString().replace(/\/+$/, ""), token }
  } catch {
    return { error: "REDIS_URL is invalid" }
  }
}

export function isRedisConfigured(): boolean {
  const configured = configuration()
  return Boolean(configured && !configured.error)
}

export async function executeRedisCommand<T>(
  command: Array<string | number>,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<RedisCommandResult<T>> {
  const configured = configuration()
  if (!configured) return { configured: false }
  if ("error" in configured) {
    return {
      configured: true,
      error: configured.error || "REDIS_URL is invalid",
    }
  }

  try {
    const response = await fetch(configured.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configured.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!response.ok) {
      return {
        configured: true,
        error: `Redis returned HTTP ${response.status}`,
      }
    }

    const payload = (await response.json()) as {
      result?: T
      error?: string
    }
    if (payload.error) {
      return { configured: true, error: payload.error }
    }
    return { configured: true, result: payload.result as T }
  } catch (error) {
    return {
      configured: true,
      error: error instanceof Error ? error.message : "Redis request failed",
    }
  }
}
