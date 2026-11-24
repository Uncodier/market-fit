import 'server-only'
import { hashRedisKeyPart } from '@/lib/redis/control-plane'
import { executeRedisCommand } from '@/lib/redis/upstash-rest'
import type { SiteRow } from './list-accessible-sites'

const TTL_SECONDS = 60
const REDIS_BUDGET_MS = 250
export type SelectorCacheReason = 'hit' | 'bypass' | 'empty' | 'expired' | 'invalid' | 'unavailable' | 'disabled' | 'coalesced'
type SelectorResult = {
  sites: SiteRow[]
  authoritative: boolean
  cache: 'hit' | 'miss'
  cacheReason: SelectorCacheReason
  cacheReadMs?: number
  cacheFillMs?: number
  revalidateAfterMs?: number
}

type CacheMiss = Exclude<SelectorCacheReason, 'hit' | 'bypass' | 'coalesced'>
type Lookup = { reason: 'hit'; sites: SiteRow[]; savedAt: number } | { reason: CacheMiss }
type TimedLookup = Lookup & { readMs?: number }
type DatabaseResult = { sites: SiteRow[]; fillMs?: number }
type ReadSites = (signal: AbortSignal) => Promise<SiteRow[]>
type Fill = {
  fresh: boolean
  pending: boolean
  replaced: boolean
  promise: Promise<DatabaseResult>
  replace: (replacement: Promise<DatabaseResult>) => void
}
type Scope = {
  readers: number
  lookup?: Promise<TimedLookup>
  fill?: Fill
  write?: Promise<number | undefined>
}
const inflight = new Map<string, Scope>()
const FIELDS = ['id', 'name', 'url', 'description', 'user_id', 'created_at', 'updated_at'] as const

function project(rows: SiteRow[]): SiteRow[] {
  return rows.map(row => ({
    ...Object.fromEntries(FIELDS.map(field => [field, row[field] ?? null])),
    id: row.id, billing_read_status: 'unavailable',
  }))
}

function decode(raw: unknown): Lookup {
  if (raw === null) return { reason: 'empty' }
  if (typeof raw !== 'string') return { reason: 'invalid' }
  try {
    const entry = JSON.parse(raw)
    const savedAt = entry?.savedAt
    if (!Number.isFinite(savedAt) || savedAt > Date.now()) return { reason: 'invalid' }
    if (Date.now() - savedAt >= TTL_SECONDS * 1000) return { reason: 'expired' }
    const value = entry.sites
    if (!Array.isArray(value) || !value.every(row => row && typeof row.id === 'string' &&
      typeof row.name === 'string' && typeof row.user_id === 'string' &&
      FIELDS.every(field => row[field] == null || typeof row[field] === 'string'))) return { reason: 'invalid' }
    return { sites: project(value), savedAt, reason: 'hit' }
  } catch { return { reason: 'invalid' } }
}

async function readCache(key: string): Promise<TimedLookup> {
  const start = performance.now()
  const result = await executeRedisCommand<string | null>(['GET', key], REDIS_BUDGET_MS).catch(() => null)
  const readMs = performance.now() - start
  if (!result || result.error) return { reason: 'unavailable', readMs }
  if (!result.configured) return { reason: 'disabled' }
  return { ...decode(result.result), readMs }
}

async function writeCache(key: string, sites: SiteRow[], savedAt: number) {
  const start = performance.now()
  const result = await executeRedisCommand(
    ['SET', key, JSON.stringify({ sites, savedAt }), 'EX', TTL_SECONDS], REDIS_BUDGET_MS,
  ).catch(() => null)
  return result?.configured === false ? undefined : performance.now() - start
}

function startFill(
  scope: Scope, key: string, readSites: ReadSites,
  fresh: boolean, cacheDisabled: boolean,
): Fill {
  const previous = scope.fill
  const controller = new AbortController()
  let follow!: (value: Promise<DatabaseResult>) => void
  const replaced = new Promise<DatabaseResult>(resolve => { follow = resolve })
  const query = Promise.resolve().then(async () => {
    // Independent from a subscriber disconnect; bound age from the start of the scan.
    const savedAt = Date.now()
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)])
    const sites = await readSites(signal)
    if (signal.aborted) throw new Error('The complete project list is temporarily unavailable')
    const value = project(sites)
    if (cacheDisabled) return { sites: value }
    // A superseded fill must not start a write. If one was already sent, finish it
    // before sending the replacement write; this serialization is process-local.
    await scope.write
    if (controller.signal.aborted) return replaced
    const write = writeCache(key, value, savedAt)
    scope.write = write
    try { return { sites: value, fillMs: await write } }
    finally { if (scope.write === write) scope.write = undefined }
  })
  const fill: Fill = {
    fresh, pending: true, replaced: false,
    promise: Promise.race([
      query.then(result => fill.replaced ? replaced : result, error => {
        if (fill.replaced) return replaced
        throw error
      }),
      replaced,
    ]).finally(() => { fill.pending = false }),
    replace(replacement) {
      fill.replaced = true
      follow(replacement)
      controller.abort()
    },
  }
  scope.fill = fill
  if (previous?.pending) previous.replace(fill.promise)
  return fill
}

async function databaseResponse(
  fill: Fill, reason: CacheMiss | 'bypass' | 'coalesced', cacheReadMs?: number,
): Promise<SelectorResult> {
  const result = await fill.promise
  return structuredClone({
    sites: result.sites, authoritative: true, cache: 'miss',
    cacheReason: fill.replaced ? 'coalesced' : reason,
    cacheReadMs,
    cacheFillMs: reason === 'coalesced' || fill.replaced ? undefined : result.fillMs,
  })
}

/** Call only after fresh authentication and the workspace location gate.
 * Cache entries contain presentation metadata, never authorization or billing.
 * Only pending work is shared in-process; Redis failure falls back to the DB.
 */
export async function readSelectorSites(userId: string, readSites: ReadSites, fresh = false): Promise<SelectorResult> {
  const namespace = `${process.env.NEXT_PUBLIC_SUPABASE_URL}|${process.env.VERCEL_ENV ?? process.env.NODE_ENV}`
  const key = `sites:selector:v3:${await hashRedisKeyPart(`${namespace}:${userId}`)}`
  const scope = inflight.get(key) ?? { readers: 0 }
  inflight.set(key, scope)
  scope.readers += 1
  try {
    const beforeLookup = scope.fill
    if (beforeLookup?.pending && (!fresh || beforeLookup.fresh)) {
      return await databaseResponse(beforeLookup, 'coalesced')
    }
    if (fresh) {
      // A fresh read after a mutation cannot join a cached miss's earlier scan.
      return await databaseResponse(startFill(scope, key, readSites, true, false), 'bypass')
    }
    const sharedLookup = Boolean(scope.lookup)
    const lookup = await (scope.lookup ??= readCache(key).finally(() => { scope.lookup = undefined }))
    const cacheReadMs = sharedLookup ? undefined : lookup.readMs
    if (scope.fill && scope.fill !== beforeLookup) {
      // An overlapping authoritative fill wins even if Redis returned an old hit
      // or the fill finished before the pending Redis response.
      return await databaseResponse(scope.fill, 'coalesced', cacheReadMs)
    }
    const reason = lookup.reason === 'hit' ? 'expired' : lookup.reason
    if (lookup.reason === 'hit') {
      const revalidateAfterMs = TTL_SECONDS * 1000 - (Date.now() - lookup.savedAt)
      if (revalidateAfterMs > 0 && revalidateAfterMs <= TTL_SECONDS * 1000) {
        return structuredClone({ sites: lookup.sites, authoritative: false, cache: 'hit',
          cacheReason: sharedLookup ? 'coalesced' : 'hit', cacheReadMs, revalidateAfterMs })
      }
    }
    return await databaseResponse(startFill(scope, key, readSites, false, reason === 'disabled'),
      reason, cacheReadMs)
  } finally {
    scope.readers -= 1
    if (!scope.readers) inflight.delete(key)
  }
}