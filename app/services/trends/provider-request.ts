import type { TrendFetchOptions, TrendItem, TrendPlatform, TrendResponse } from '@/app/types/trends'

export const FAILURE_COOLDOWN_MS = 30_000
export const SUCCESS_CACHE_MS = 5 * 60_000
export const PROVIDER_TIMEOUT_MS = { google: 75_000, reddit: 25_000 } as const

const labels: Partial<Record<TrendPlatform, string>> = { google: 'Google', reddit: 'Reddit' }

class TrendRequestError extends Error {}

function safeProviderMessage(platform: TrendPlatform, status: number): string {
  const label = labels[platform] ?? platform
  // Never consume arbitrary error/details fields, including on otherwise successful responses.
  if (status === 401) return `Authentication required to fetch ${label} trends`
  if (status === 403) return `Access denied to ${label} trends`
  if (status === 400) return `Invalid ${label} trends request`
  if (status === 413) return `${label} trends request is too large`
  if (status === 429) return `${label} trends rate limit reached. Please try again later`
  if (status === 503) return `${label} trends are temporarily unavailable`
  return `Failed to fetch ${label} trends`
}

export function failedTrendResponse(platform: TrendPlatform, error?: string): TrendResponse {
  return {
    success: false,
    error: error ?? `Failed to fetch ${labels[platform] ?? platform} trends`,
    platform,
    timestamp: new Date().toISOString(),
  }
}

/** Single attempt, bounded through body consumption; abort even if a transport ignores the signal. */
async function postTrends(platform: keyof typeof PROVIDER_TIMEOUT_MS, payload: object): Promise<unknown[]> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(`/api/trends/${platform}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        let body: unknown
        try { body = await response.json() } catch {
          throw new TrendRequestError(safeProviderMessage(platform, response.status))
        }
        if (!response.ok || (body && typeof body === 'object' && 'success' in body && body.success === false)) {
          throw new TrendRequestError(safeProviderMessage(platform, response.status))
        }
        if (!body || typeof body !== 'object' || !('trends' in body) || !Array.isArray(body.trends)) {
          throw new TrendRequestError(`Invalid ${labels[platform]} trends response`)
        }
        return body.trends
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new TrendRequestError(`${labels[platform]} trends request timed out`))
          controller.abort()
        }, PROVIDER_TIMEOUT_MS[platform])
      }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/**
 * These public provider results contain no private site/auth data. Identity is the
 * normalized provider payload (including descriptions and limit), not tenant IDs.
 * Commercial scoring remains outside this cache and is recomputed for each caller.
 */
export class ProviderRequests {
  private inFlight = new Map<string, Promise<TrendResponse>>()
  private settled = new Map<string, { response: TrendResponse; expiresAt: number }>()

  constructor(private platform: keyof typeof PROVIDER_TIMEOUT_MS) {}

  fetch(payload: object, mapItems: (items: unknown[]) => TrendItem[], options: TrendFetchOptions = {}): Promise<TrendResponse> {
    const key = JSON.stringify(payload)
    const running = this.inFlight.get(key)
    if (running) return running
    const now = Date.now()
    for (const [cachedKey, cached] of this.settled) {
      if (cached.expiresAt <= now) this.settled.delete(cachedKey)
    }
    const cached = this.settled.get(key)
    if (!options.forceRefresh && cached) return Promise.resolve(cached.response)

    const request = (async () => {
      let response: TrendResponse
      try {
        const data = mapItems(await postTrends(this.platform, payload))
        response = { success: true, data, count: data.length, platform: this.platform, timestamp: new Date().toISOString() }
      } catch (error) {
        response = failedTrendResponse(this.platform, error instanceof TrendRequestError ? error.message : undefined)
      }
      this.settled.delete(key)
      this.settled.set(key, { response, expiresAt: Date.now() + (response.success ? SUCCESS_CACHE_MS : FAILURE_COOLDOWN_MS) })
      // Bound memory across changing contexts, without discarding running requests.
      if (this.settled.size > 100) this.settled.delete(this.settled.keys().next().value!)
      return response
    })().finally(() => this.inFlight.delete(key))
    this.inFlight.set(key, request)
    return request
  }
}