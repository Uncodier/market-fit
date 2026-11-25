/** @jest-environment node */
jest.mock('server-only', () => ({}))
jest.mock('@/lib/redis/control-plane', () => ({ hashRedisKeyPart: jest.fn(async (value: string) => value) }))
jest.mock('@/lib/redis/upstash-rest', () => ({ executeRedisCommand: jest.fn() }))
jest.mock('@/lib/sites/list-accessible-sites', () => ({ listAccessibleSitesForUser: jest.fn() }))

import { executeRedisCommand } from '@/lib/redis/upstash-rest'
import { listAccessibleSitesForUser } from '@/lib/sites/list-accessible-sites'
import { readSelectorSites } from '@/lib/sites/selector-cache'

const row = { id: 'site', name: 'Example', user_id: 'owner', billing: { secret: true }, settings: { secret: true } }
const createAdmin = jest.fn(async (signal: AbortSignal) => {
  const result = await listAccessibleSitesForUser({ from: jest.fn(), rpc: jest.fn() }, 'actor', signal)
  if (result.error) throw new Error('The complete project list is temporarily unavailable')
  return result.sites
})
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(executeRedisCommand).mockResolvedValue({ configured: true, result: null })
  jest.mocked(listAccessibleSitesForUser).mockResolvedValue({ sites: [row], error: null })
})

it('uses a user/environment scoped cache containing only presentation data', async () => {
  const result = await readSelectorSites('actor', createAdmin)
  expect(result.authoritative).toBe(true)
  expect(result.sites[0]).not.toHaveProperty('settings')
  expect(result.sites[0]).not.toHaveProperty('billing')
  const write = jest.mocked(executeRedisCommand).mock.calls.find(([args]) => args[0] === 'SET')!
  expect(write[0][1]).toContain(':actor')
  expect(write[0].slice(-2)).toEqual(['EX', 60])
  expect(write[0][2]).not.toContain('secret')
  expect(listAccessibleSitesForUser).toHaveBeenCalledWith(expect.anything(), 'actor', expect.any(AbortSignal))
})

it('does not treat a cache hit as authoritative or query the database', async () => {
  jest.mocked(executeRedisCommand).mockResolvedValue({ configured: true, result: JSON.stringify({ sites: [row], savedAt: Date.now() }) })
  const result = await readSelectorSites('hit', createAdmin)
  expect(result.authoritative).toBe(false)
  expect(result.sites[0]).not.toHaveProperty('settings')
  expect(createAdmin).not.toHaveBeenCalled()
})

it.each(['invalid', 'failure'])('falls back when Redis returns %s', async kind => {
  jest.mocked(executeRedisCommand).mockResolvedValue(kind === 'invalid'
    ? { configured: true, result: '{' } : { configured: true, error: 'Redis unavailable' })
  expect((await readSelectorSites(kind, createAdmin)).cache).toBe('miss')
  expect(listAccessibleSitesForUser).toHaveBeenCalledTimes(1)
})

it('never caches or returns a partial failed list', async () => {
  jest.mocked(listAccessibleSitesForUser).mockResolvedValue({ sites: [row], error: 'Membership failed' })
  await expect(readSelectorSites('failure', createAdmin)).rejects.toThrow('complete project list')
  expect(jest.mocked(executeRedisCommand).mock.calls.every(([args]) => args[0] === 'GET')).toBe(true)
})

it('shares pending work only for the same actor and returns independent objects', async () => {
  const [a, b, c] = await Promise.all([
    readSelectorSites('a', createAdmin), readSelectorSites('a', createAdmin), readSelectorSites('b', createAdmin),
  ])
  expect(listAccessibleSitesForUser).toHaveBeenCalledTimes(2)
  a.sites[0].name = 'Changed'
  expect(b.sites[0].name).toBe('Example')
  expect(c.sites[0].name).toBe('Example')
})

it('bypasses cached membership metadata for explicit authoritative revalidation', async () => {
  jest.mocked(executeRedisCommand).mockResolvedValue({ configured: true, result: JSON.stringify({ sites: [row], savedAt: Date.now() }) })
  jest.mocked(listAccessibleSitesForUser).mockResolvedValue({ sites: [], error: null })
  const result = await readSelectorSites('refresh', createAdmin, true)
  expect(result).toMatchObject({ sites: [], authoritative: true, cache: 'miss', cacheReason: 'bypass' })
  expect(jest.mocked(executeRedisCommand).mock.calls.some(([args]) => args[0] === 'GET')).toBe(false)
})

it('returns the remaining freshness budget without refreshing the stored timestamp', async () => {
  jest.useFakeTimers()
  try {
    const savedAt = Date.now() - 25_000
    jest.mocked(executeRedisCommand).mockResolvedValue({ configured: true, result: JSON.stringify({ sites: [row], savedAt }) })
    const result = await readSelectorSites('age', createAdmin)
    expect(result.revalidateAfterMs).toBe(35_000)
    expect(listAccessibleSitesForUser).not.toHaveBeenCalled()
    expect(executeRedisCommand).toHaveBeenCalledTimes(1)
  } finally { jest.useRealTimers() }
})

it.each([-1, 60_000, 120_000])('rejects expired or future cache timestamps (age=%s)', async age => {
  jest.useFakeTimers()
  try {
    jest.mocked(executeRedisCommand).mockResolvedValue({ configured: true,
      result: JSON.stringify({ sites: [row], savedAt: Date.now() - age }) })
    expect((await readSelectorSites(`expired-${age}`, createAdmin)).authoritative).toBe(true)
    expect(listAccessibleSitesForUser).toHaveBeenCalledTimes(1)
  } finally { jest.useRealTimers() }
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

it('joins pending fresh work without reading Redis or writing twice', async () => {
  const db = deferred<{ sites: typeof row[]; error: null }>()
  const started = deferred<void>()
  jest.mocked(listAccessibleSitesForUser).mockImplementationOnce(() => { started.resolve(); return db.promise })
  const fresh = readSelectorSites('fresh-first', createAdmin, true)
  await started.promise
  const cached = readSelectorSites('fresh-first', createAdmin)
  db.resolve({ sites: [row], error: null })
  expect(await fresh).toMatchObject({ cache: 'miss', cacheReason: 'bypass', authoritative: true })
  expect(await cached).toMatchObject({ cache: 'miss', cacheReason: 'coalesced', authoritative: true })
  expect(listAccessibleSitesForUser).toHaveBeenCalledTimes(1)
  expect(executeRedisCommand).toHaveBeenCalledTimes(1)
  expect(executeRedisCommand).toHaveBeenCalledWith(['SET', expect.any(String), expect.any(String), 'EX', 60], 250)
})

it('prefers an overlapping fresh result to a later Redis response, even after the fresh read finishes', async () => {
  const redis = deferred<{ configured: true; result: string }>()
  const started = deferred<void>()
  jest.mocked(executeRedisCommand).mockImplementationOnce(() => { started.resolve(); return redis.promise })
  jest.mocked(listAccessibleSitesForUser).mockResolvedValue({ sites: [], error: null })
  const cached = readSelectorSites('pending-lookup', createAdmin)
  await started.promise
  await readSelectorSites('pending-lookup', createAdmin, true)
  redis.resolve({ configured: true, result: JSON.stringify({ sites: [row], savedAt: Date.now() }) })
  expect(await cached).toMatchObject({ sites: [], authoritative: true, cacheReason: 'coalesced' })
  expect(listAccessibleSitesForUser).toHaveBeenCalledTimes(1)
  expect(executeRedisCommand).toHaveBeenCalledTimes(2)
})

it('preempts an older cached-miss scan without letting it write or return the out-of-date rows', async () => {
  const old = deferred<{ sites: typeof row[]; error: null }>()
  const started = deferred<void>()
  const list = jest.mocked(listAccessibleSitesForUser).mockImplementationOnce(() => { started.resolve(); return old.promise })
    .mockResolvedValueOnce({ sites: [], error: null })
  const cached = readSelectorSites('preempted', createAdmin)
  await started.promise
  const fresh = readSelectorSites('preempted', createAdmin, true)
  expect((await fresh).sites).toEqual([])
  expect(await cached).toMatchObject({ sites: [], cacheReason: 'coalesced' })
  expect(list.mock.calls[0][2]?.aborted).toBe(true)
  old.resolve({ sites: [row], error: null })
  await old.promise
  expect(executeRedisCommand).toHaveBeenCalledTimes(2)
})

it('serializes a new authoritative write behind an already sent write', async () => {
  const firstWrite = deferred<{ configured: true; result: string }>()
  const writing = deferred<void>()
  const freshStarted = deferred<void>()
  jest.mocked(executeRedisCommand).mockImplementationOnce(async () => ({ configured: true, result: null }))
    .mockImplementationOnce(() => { writing.resolve(); return firstWrite.promise })
  jest.mocked(listAccessibleSitesForUser).mockResolvedValueOnce({ sites: [row], error: null })
    .mockImplementationOnce(async () => { freshStarted.resolve(); return { sites: [], error: null } })
  const cached = readSelectorSites('overlapping-write', createAdmin)
  await writing.promise
  const fresh = readSelectorSites('overlapping-write', createAdmin, true)
  await freshStarted.promise
  expect(executeRedisCommand).toHaveBeenCalledTimes(2)
  firstWrite.resolve({ configured: true, result: 'OK' })
  expect((await fresh).sites).toEqual([])
  expect((await cached).sites).toEqual([])
  expect(executeRedisCommand).toHaveBeenCalledTimes(3)
  const write = jest.mocked(executeRedisCommand).mock.calls[2][0]
  expect(JSON.parse(String(write[2])).sites).toEqual([])
})

it('stamps a fill with the beginning of its DB scan rather than renewing age at write time', async () => {
  jest.useFakeTimers()
  try {
    const startedAt = Date.now()
    jest.mocked(listAccessibleSitesForUser).mockImplementationOnce(async () => {
      jest.advanceTimersByTime(3500)
      return { sites: [row], error: null }
    })
    await readSelectorSites('fill-age', createAdmin)
    const write = jest.mocked(executeRedisCommand).mock.calls[1][0]
    expect(JSON.parse(String(write[2])).savedAt).toBe(startedAt)
  } finally { jest.useRealTimers() }
})

it('skips a pointless SET when Redis is not configured', async () => {
  jest.mocked(executeRedisCommand).mockResolvedValue({ configured: false })
  expect(await readSelectorSites('no-redis', createAdmin)).toMatchObject({
    authoritative: true, cache: 'miss', cacheReason: 'disabled',
  })
  expect(executeRedisCommand).toHaveBeenCalledTimes(1)
  expect(listAccessibleSitesForUser).toHaveBeenCalledTimes(1)
})

it('does not turn a Redis write failure into a failed complete database read', async () => {
  jest.mocked(executeRedisCommand).mockResolvedValueOnce({ configured: true, result: null })
    .mockRejectedValueOnce(new Error('Optional Redis write failed'))
  expect(await readSelectorSites('redis-write-failed', createAdmin)).toMatchObject({
    authoritative: true, cache: 'miss', cacheReason: 'empty', sites: [{ id: 'site' }],
  })
})

it('does not share a pending actor lookup across Supabase environments', async () => {
  const original = process.env.NEXT_PUBLIC_SUPABASE_URL
  const first = deferred<{ sites: typeof row[]; error: null }>()
  const firstStarted = deferred<void>()
  const second = deferred<{ sites: typeof row[]; error: null }>()
  const secondStarted = deferred<void>()
  jest.mocked(listAccessibleSitesForUser)
    .mockImplementationOnce(() => { firstStarted.resolve(); return first.promise })
    .mockImplementationOnce(() => { secondStarted.resolve(); return second.promise })
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://first.example.test'
    const a = readSelectorSites('shared-actor', createAdmin, true)
    await firstStarted.promise
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://second.example.test'
    const b = readSelectorSites('shared-actor', createAdmin, true)
    await secondStarted.promise
    first.resolve({ sites: [row], error: null })
    second.resolve({ sites: [], error: null })
    expect((await a).sites).toHaveLength(1)
    expect((await b).sites).toHaveLength(0)
    expect(listAccessibleSitesForUser).toHaveBeenCalledTimes(2)
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = original
  }
})