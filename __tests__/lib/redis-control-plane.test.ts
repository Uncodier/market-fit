/** @jest-environment node */

import {
  acquireLock,
  checkRateLimit,
  releaseLock,
} from "@/lib/redis/control-plane"
import { normalizedRequestCacheKey } from "@/lib/redis/json-cache"

describe("Redis control plane", () => {
  const originalUrl = process.env.REDIS_URL

  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.REDIS_URL
  })

  afterAll(() => {
    if (originalUrl === undefined) delete process.env.REDIS_URL
    else process.env.REDIS_URL = originalUrl
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
