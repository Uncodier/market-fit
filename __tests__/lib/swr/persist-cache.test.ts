/**
 * @jest-environment jsdom
 */

import {
  MAX_ENTRY_CHARS,
  MAX_TOTAL_CHARS,
  SWR_CACHE_KEY,
  buildPersistableCachePayload,
  loadSWRCache,
  persistSWRCache,
  writeSWRCachePayload,
} from '@/lib/swr/persist-cache'

describe('SWR persist cache', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.restoreAllMocks()
  })

  it('skips bulky keys in both string and array form', () => {
    const payload = buildPersistableCachePayload([
      ['@"chat-messages","c1",', { data: { messages: [1] } }],
      [['imprenta-data', 'i1', 's1'], { data: { nodes: [] } }],
      [['instance_logs', 'r1'], { data: { logs: [] } }],
      ['@"leads","site-1",', { data: { leads: [{ id: 1 }] } }],
      ['locations', { data: [{ id: 'loc-1' }] }],
    ])

    const parsed = JSON.parse(payload) as [unknown, unknown][]
    const keys = parsed.map(([key]) => JSON.stringify(key))

    expect(keys.some((key) => key.includes('locations'))).toBe(true)
    expect(keys.some((key) => key.includes('chat-messages'))).toBe(false)
    expect(keys.some((key) => key.includes('imprenta-data'))).toBe(false)
    expect(keys.some((key) => key.includes('instance_logs'))).toBe(false)
    expect(keys.some((key) => key.includes('leads'))).toBe(false)
  })

  it('drops entries larger than the per-entry budget', () => {
    const huge = { data: 'x'.repeat(MAX_ENTRY_CHARS) }
    const payload = buildPersistableCachePayload([
      ['tiny', { data: 'ok' }],
      ['huge', huge],
    ])

    const parsed = JSON.parse(payload) as [string, unknown][]
    expect(parsed.map(([key]) => key)).toEqual(['tiny'])
  })

  it('caps the total payload under the character budget', () => {
    const entrySize = 20_000
    const entries: [unknown, unknown][] = Array.from({ length: 60 }, (_, index) => [
      `key-${index}`,
      { data: 'y'.repeat(entrySize) },
    ])

    const payload = buildPersistableCachePayload(entries)
    expect(payload.length).toBeLessThanOrEqual(MAX_TOTAL_CHARS)
    expect(JSON.parse(payload).length).toBeGreaterThan(0)
    expect(JSON.parse(payload).length).toBeLessThan(entries.length)
  })

  it('persists a trimmed cache and restores it', () => {
    const map = new Map<unknown, unknown>([
      ['locations', { data: [{ id: 'loc-1' }] }],
      [['chat-messages', 'c1'], { data: { messages: ['nope'] } }],
    ])

    persistSWRCache(map)

    const stored = JSON.parse(localStorage.getItem(SWR_CACHE_KEY) || '[]') as [unknown, unknown][]
    expect(stored).toHaveLength(1)
    expect(stored[0][0]).toBe('locations')

    const restored = loadSWRCache()
    expect(restored.get('locations')).toEqual({ data: [{ id: 'loc-1' }] })
  })

  it('shrinks an already oversized cache on load', () => {
    localStorage.setItem(
      SWR_CACHE_KEY,
      JSON.stringify([
        ['locations', { data: [{ id: 'loc-1' }] }],
        ['@"chat-messages","c1",', { data: { messages: ['huge'] } }],
      ])
    )

    const restored = loadSWRCache()
    const stored = JSON.parse(localStorage.getItem(SWR_CACHE_KEY) || '[]') as [unknown, unknown][]

    expect(restored.get('locations')).toEqual({ data: [{ id: 'loc-1' }] })
    expect(stored).toHaveLength(1)
    expect(stored[0][0]).toBe('locations')
  })

  it('recovers from QuotaExceededError without throwing', () => {
    const originalSetItem = Storage.prototype.setItem
    let attempts = 0
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ) {
      if (key === SWR_CACHE_KEY) {
        attempts += 1
        if (attempts === 1) {
          throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
        }
      }
      return originalSetItem.call(this, key, value)
    })

    expect(() => writeSWRCachePayload('[["locations",{"data":1}]]')).not.toThrow()
    expect(localStorage.getItem(SWR_CACHE_KEY)).toBe('[["locations",{"data":1}]]')
  })

  it('drops the cache when quota is still exceeded after a retry', () => {
    localStorage.setItem(SWR_CACHE_KEY, 'stale')
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    })

    expect(() => writeSWRCachePayload('[["locations",{"data":1}]]')).not.toThrow()
    expect(localStorage.getItem(SWR_CACHE_KEY)).toBeNull()
  })

  it('starts empty when stored JSON is corrupt', () => {
    localStorage.setItem(SWR_CACHE_KEY, '{not-json')
    const map = loadSWRCache()
    expect(map.size).toBe(0)
    expect(localStorage.getItem(SWR_CACHE_KEY)).toBeNull()
  })
})
