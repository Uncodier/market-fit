/** @jest-environment node */
jest.mock('server-only', () => ({}))
jest.mock('@/lib/redis/control-plane', () => ({ hashRedisKeyPart: jest.fn(async (value: string) => value) }))
jest.mock('@/lib/redis/upstash-rest', () => ({ executeRedisCommand: jest.fn() }))
jest.mock('@/lib/sites/list-accessible-sites', () => ({ listAccessibleSitesForUser: jest.fn() }))

import { executeRedisCommand } from '@/lib/redis/upstash-rest'
import { listAccessibleSitesForUser } from '@/lib/sites/list-accessible-sites'
import { readSelectorSites } from '@/lib/sites/selector-cache'

const row = { id: 'site', name: 'Example', user_id: 'owner', billing: { secret: true }, settings: { secret: true } }
const createAdmin = jest.fn(() => ({ from: jest.fn() }))
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(executeRedisCommand).mockResolvedValue({ configured: false })
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
  expect(result).toEqual({ sites: [], authoritative: true, cache: 'miss' })
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