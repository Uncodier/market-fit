import 'server-only'
import { hashRedisKeyPart } from '@/lib/redis/control-plane'
import { executeRedisCommand } from '@/lib/redis/upstash-rest'
import { listAccessibleSitesForUser, type SitesAdminClient, type SiteRow } from './list-accessible-sites'

const TTL_SECONDS = 60
const REDIS_BUDGET_MS = 250
const inflight = new Map<string, Promise<SelectorResult>>()
type SelectorResult = { sites: SiteRow[]; authoritative: boolean; cache: 'hit' | 'miss'; revalidateAfterMs?: number }
const FIELDS = ['id', 'name', 'url', 'description', 'user_id', 'created_at', 'updated_at'] as const

function project(rows: SiteRow[]): SiteRow[] {
  return rows.map(row => ({
    ...Object.fromEntries(FIELDS.map(field => [field, row[field] ?? null])),
    id: row.id, billing_read_status: 'unavailable',
  }))
}

function decode(raw: unknown): { sites: SiteRow[]; revalidateAfterMs: number } | null {
  if (typeof raw !== 'string') return null
  try {
    const entry = JSON.parse(raw)
    const age = Date.now() - entry?.savedAt
    if (!Number.isFinite(age) || age < 0 || age >= TTL_SECONDS * 1000) return null
    const value = entry.sites
    if (!Array.isArray(value) || !value.every(row => row && typeof row.id === 'string' &&
      typeof row.name === 'string' && typeof row.user_id === 'string')) return null
    return { sites: project(value), revalidateAfterMs: TTL_SECONDS * 1000 - age }
  } catch { return null }
}

/** Call only after fresh authentication and the workspace location gate.
 * Cache entries contain presentation metadata, never authorization or billing.
 * Only pending work is shared in-process; Redis failure falls back to the DB.
 */
export async function readSelectorSites(userId: string, createAdmin: (signal: AbortSignal) => SitesAdminClient, fresh = false): Promise<SelectorResult> {
  const namespace = `${process.env.NEXT_PUBLIC_SUPABASE_URL}|${process.env.VERCEL_ENV ?? process.env.NODE_ENV}`
  const key = `sites:selector:v2:${await hashRedisKeyPart(`${namespace}:${userId}`)}`
  const pendingKey = `${key}:${fresh ? 'fresh' : 'cached'}`
  let pending = inflight.get(pendingKey)
  if (!pending) {
    pending = (async () => {
      const cached = fresh ? null : await executeRedisCommand<string | null>(['GET', key], REDIS_BUDGET_MS)
      const rows = cached?.configured && !cached.error ? decode(cached.result) : null
      if (rows) return { ...rows, authoritative: false, cache: 'hit' as const }
      // Independent from any one subscriber's disconnect. Still bounded in duration.
      const signal = AbortSignal.timeout(5_000)
      const { sites, error } = await listAccessibleSitesForUser(createAdmin(signal), userId, signal)
      if (error || signal.aborted) throw new Error('The complete project list is temporarily unavailable')
      const value = project(sites)
      await executeRedisCommand(['SET', key, JSON.stringify({ sites: value, savedAt: Date.now() }), 'EX', TTL_SECONDS], REDIS_BUDGET_MS)
      return { sites: value, authoritative: true, cache: 'miss' as const }
    })().finally(() => { inflight.delete(pendingKey) })
    inflight.set(pendingKey, pending)
  }
  return structuredClone(await pending)
}