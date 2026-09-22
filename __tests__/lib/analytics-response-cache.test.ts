/** @jest-environment node */

import { readThroughAnalyticsResponseCache } from "@/lib/redis/analytics-response-cache"
import {
  normalizedRequestCacheKey,
  readThroughJsonCache,
} from "@/lib/redis/json-cache"

jest.mock("@/lib/redis/json-cache", () => ({
  normalizedRequestCacheKey: jest.fn(),
  readThroughJsonCache: jest.fn(),
}))

const normalizedRequestCacheKeyMock =
  normalizedRequestCacheKey as jest.MockedFunction<
    typeof normalizedRequestCacheKey
  >
const readThroughJsonCacheMock = readThroughJsonCache as jest.Mock

describe("readThroughAnalyticsResponseCache", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    normalizedRequestCacheKeyMock.mockResolvedValue("cache:key")
  })

  it("uses a tenant-scoped normalized key and preserves successful responses", async () => {
    readThroughJsonCacheMock.mockImplementation(async ({ compute }) => ({
      status: "computed",
      value: await compute(),
    }))

    const response = await readThroughAnalyticsResponseCache({
      request: new Request(
        "https://example.test/api/performance/sales?siteId=untrusted&startDate=1&endDate=2"
      ),
      namespace: "performance:sales",
      siteId: "site-a",
      lockTtlMs: 30_000,
      load: async () =>
        new Response('{"actual":7}', {
          headers: {
            "Content-Type": "application/json",
            "X-Source": "database",
          },
        }),
    })

    const keyRequest = normalizedRequestCacheKeyMock.mock.calls[0][1]
    expect(normalizedRequestCacheKeyMock).toHaveBeenCalledWith(
      "analytics:performance:sales",
      expect.any(Request)
    )
    expect(new URL(keyRequest.url).searchParams.get("siteId")).toBe("site-a")
    expect(readThroughJsonCacheMock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "cache:key",
        ttlSeconds: 60,
        lockTtlMs: 30_000,
      })
    )
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/json")
    expect(response.headers.get("X-Source")).toBe("database")
    expect(response.headers.get("X-Cache")).toBe("COMPUTED")
    await expect(response.text()).resolves.toBe('{"actual":7}')
  })

  it("returns non-2xx responses without producing a cacheable value", async () => {
    readThroughJsonCacheMock.mockImplementation(async ({ compute }) => ({
      status: "computed",
      value: await compute(),
    }))

    const response = await readThroughAnalyticsResponseCache({
      request: new Request(
        "https://example.test/api/traffic/visits?siteId=site-a&startDate=1&endDate=2"
      ),
      namespace: "traffic:visits",
      siteId: "site-a",
      load: async () =>
        new Response('{"error":"failed"}', {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }),
    })

    expect(response.status).toBe(502)
    expect(response.headers.get("X-Cache")).toBeNull()
    await expect(response.text()).resolves.toBe('{"error":"failed"}')
  })

  it("returns a retryable response when cache computation is busy", async () => {
    readThroughJsonCacheMock.mockResolvedValue({ status: "busy" })

    const load = jest.fn()
    const response = await readThroughAnalyticsResponseCache({
      request: new Request(
        "https://example.test/api/traffic/visits?siteId=site-a&startDate=1&endDate=2"
      ),
      namespace: "traffic:visits",
      siteId: "site-a",
      load,
    })

    expect(load).not.toHaveBeenCalled()
    expect(response.status).toBe(503)
    expect(response.headers.get("Retry-After")).toBe("2")
  })
})
