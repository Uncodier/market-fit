/** @jest-environment node */

import {
  acquireLock,
  acquireSemaphoreResult,
  checkRateLimit,
  releaseLock,
  releaseSemaphore,
  renewSemaphore,
} from "@/lib/redis/control-plane"
import {
  bumpCacheEpoch,
  normalizedRequestCacheKey,
  readCacheEpoch,
} from "@/lib/redis/json-cache"
import { acquireOperationLease } from "@/lib/redis/operation-lease"

describe("Redis control plane", () => {
  const originalUrl = process.env.REDIS_URL
  const originalRequired = process.env.REDIS_REQUIRED

  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.REDIS_URL
    delete process.env.REDIS_REQUIRED
  })

  afterAll(() => {
    if (originalUrl === undefined) delete process.env.REDIS_URL
    else process.env.REDIS_URL = originalUrl
    if (originalRequired === undefined) delete process.env.REDIS_REQUIRED
    else process.env.REDIS_REQUIRED = originalRequired
  })

  it("honors explicit fail-open and fail-closed policies", async () => {
    await expect(
      checkRateLimit("test", {
        limit: 1,
        windowSeconds: 60,
        failureMode: "open",
      })
    ).resolves.toMatchObject({ allowed: true, unavailable: true })

    await expect(
      checkRateLimit("test", {
        limit: 1,
        windowSeconds: 60,
        failureMode: "closed",
      })
    ).resolves.toMatchObject({ allowed: false, unavailable: true })
  })

  it("returns remaining quota and reset time from the atomic script", async () => {
    process.env.REDIS_URL = "https://default:test-token@redis.example"
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: [2, 45_000] }),
    })

    const result = await checkRateLimit("rl:test", {
      limit: 3,
      windowSeconds: 60,
      failureMode: "closed",
    })

    expect(result).toEqual({
      allowed: true,
      limit: 3,
      remaining: 1,
      resetMs: 45_000,
    })
  })

  it("uses owner tokens for lock acquisition and release", async () => {
    process.env.REDIS_URL =
      "rediss://default:test-token@credible-cattle.upstash.io:6379"
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: "OK" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 1 }),
      })

    await expect(acquireLock("lock:test", "owner", 1000)).resolves.toBe(true)
    await expect(releaseLock("lock:test", "owner")).resolves.toBe(true)

    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "https://credible-cattle.upstash.io",
      expect.objectContaining({
        body: expect.stringContaining('"owner"'),
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      })
    )
  })

  it("renews a semaphore only for its current owner token", async () => {
    process.env.REDIS_URL =
      "rediss://default:test-token@credible-cattle.upstash.io:6379"
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 1 }),
    })

    await expect(
      renewSemaphore("sem:test", "owner", 30_000)
    ).resolves.toBe(true)

    expect(global.fetch).toHaveBeenCalledWith(
      "https://credible-cattle.upstash.io",
      expect.objectContaining({
        body: expect.stringContaining('"owner"'),
      })
    )
  })

  it.each([
    [[1, 1], 'acquired'],
    [[0, 1], 'contended'],
    [undefined, 'unavailable'],
    [[null, 1], 'unavailable'],
    [[false, 1], 'unavailable'],
    [['', 1], 'unavailable'],
    [[], 'unavailable'],
    [[9, 1], 'unavailable'],
  ])('classifies semaphore result %j as %s', async (result, expected) => {
    process.env.REDIS_URL = "https://default:test-token@redis.example"
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ result }) })
    await expect(acquireSemaphoreResult('sem:test', 'owner', 1, 30_000)).resolves.toBe(expected)
  })

  it('reports transport failure as unavailable, never as contention', async () => {
    process.env.REDIS_URL = "https://default:test-token@redis.example"
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 503 })
    await expect(acquireSemaphoreResult('sem:test', 'owner', 1, 30_000)).resolves.toBe('unavailable')
  })

  it.each([0, 1])('confirms idempotent owner release with Redis result %s', async result => {
    process.env.REDIS_URL = "https://default:test-token@redis.example"
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ result }) })
    await expect(releaseSemaphore('sem:test', 'owner')).resolves.toBe(true)
  })

  it('does not silently confirm a failed release', async () => {
    process.env.REDIS_URL = "https://default:test-token@redis.example"
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 503 })
    await expect(releaseSemaphore('sem:test', 'owner')).resolves.toBe(false)
  })

  it("fails closed for operation leases when Redis is required", async () => {
    process.env.REDIS_REQUIRED = "true"
    await expect(
      acquireOperationLease("export", "site-1", 30_000)
    ).resolves.toBeNull()
  })

  it("renews and releases an acquired operation lease", async () => {
    jest.useFakeTimers()
    process.env.REDIS_URL =
      "rediss://default:test-token@credible-cattle.upstash.io:6379"
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: [1, 1] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 1 }),
      })

    const lease = await acquireOperationLease("export", "site-1", 30_000)
    expect(lease).not.toBeNull()

    await jest.advanceTimersByTimeAsync(10_000)
    await lease?.release()

    expect(global.fetch).toHaveBeenCalledTimes(3)
    jest.useRealTimers()
  })

  it("reads and atomically bumps cache epochs", async () => {
    process.env.REDIS_URL =
      "rediss://default:test-token@credible-cattle.upstash.io:6379"
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: "4" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 5 }),
      })

    await expect(readCacheEpoch("orders", "site-1")).resolves.toBe("4")
    await expect(bumpCacheEpoch("orders", "site-1")).resolves.toBe(true)
  })

  it("normalizes parameter order while isolating tenant cache keys", async () => {
    const first = await normalizedRequestCacheKey(
      "analytics",
      new Request(
        "https://example.test/api?siteId=site-a&endDate=2&startDate=1"
      )
    )
    const reordered = await normalizedRequestCacheKey(
      "analytics",
      new Request(
        "https://example.test/api?startDate=1&siteId=site-a&endDate=2"
      )
    )
    const otherTenant = await normalizedRequestCacheKey(
      "analytics",
      new Request(
        "https://example.test/api?startDate=1&siteId=site-b&endDate=2"
      )
    )

    expect(reordered).toBe(first)
    expect(otherTenant).not.toBe(first)
  })
})
