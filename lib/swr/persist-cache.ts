export const SWR_CACHE_KEY = 'swr-cache'

/** Character budget for the JSON payload. Leaves room for carts and other keys. */
export const MAX_TOTAL_CHARS = 800_000
export const MAX_ENTRY_CHARS = 50_000

const SKIP_KEY_PARTS = [
  'chat-messages',
  'imprenta-data',
  'instance_logs',
  'instance-logs',
  'conversations',
  'leads',
  'assets',
  'catalog',
  'content',
  'robots',
]

function keyToString(key: unknown): string {
  if (typeof key === 'string') return key
  try {
    return JSON.stringify(key)
  } catch {
    return String(key)
  }
}

function isQuotaExceeded(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22
  )
}

function shouldSkipKey(key: unknown): boolean {
  const serializedKey = keyToString(key)
  return SKIP_KEY_PARTS.some((part) => serializedKey.includes(part))
}

export function buildPersistableCachePayload(entries: [unknown, unknown][]): string {
  const candidates: { entry: [unknown, unknown]; size: number }[] = []

  for (const [key, value] of entries) {
    if (value == null) continue
    if (shouldSkipKey(key)) continue

    let serialized: string
    try {
      serialized = JSON.stringify([key, value])
    } catch {
      continue
    }

    if (serialized.length > MAX_ENTRY_CHARS) continue
    candidates.push({ entry: [key, value], size: serialized.length })
  }

  candidates.sort((a, b) => a.size - b.size)

  const kept: [unknown, unknown][] = []
  let total = 2
  for (const candidate of candidates) {
    const extra = candidate.size + (kept.length > 0 ? 1 : 0)
    if (total + extra > MAX_TOTAL_CHARS) break
    kept.push(candidate.entry)
    total += extra
  }

  return JSON.stringify(kept)
}

export function writeSWRCachePayload(payload: string): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(SWR_CACHE_KEY, payload)
    return
  } catch (error) {
    if (!isQuotaExceeded(error)) return
  }

  try {
    localStorage.removeItem(SWR_CACHE_KEY)
    localStorage.setItem(SWR_CACHE_KEY, payload)
  } catch {
    try {
      localStorage.removeItem(SWR_CACHE_KEY)
    } catch {
      // Ignore: quota recovery is best-effort.
    }
  }
}

export function persistSWRCache(map: Map<unknown, unknown>): void {
  if (typeof window === 'undefined') return
  const payload = buildPersistableCachePayload(Array.from(map.entries()))
  writeSWRCachePayload(payload)
}

export function loadSWRCache(): Map<unknown, unknown> {
  if (typeof window === 'undefined') return new Map()

  let savedCache: string | null = null
  try {
    savedCache = localStorage.getItem(SWR_CACHE_KEY)
  } catch {
    return new Map()
  }

  let map: Map<unknown, unknown>
  try {
    map = new Map(savedCache ? JSON.parse(savedCache) : [])
  } catch {
    try {
      localStorage.removeItem(SWR_CACHE_KEY)
    } catch {
      // Ignore corrupt-cache cleanup failures.
    }
    return new Map()
  }

  const payload = buildPersistableCachePayload(Array.from(map.entries()))
  if (savedCache && savedCache.length > payload.length) {
    writeSWRCachePayload(payload)
  }

  return map
}
