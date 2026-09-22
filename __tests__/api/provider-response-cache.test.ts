/** @jest-environment node */

import dns from "node:dns/promises"
import { NextRequest } from "next/server"
import { GET as verifyMx } from "@/app/api/dns/verify-mx/route"
import { POST as googleTrends } from "@/app/api/trends/google/route"
import { POST as redditTrends } from "@/app/api/trends/reddit/route"
import { POST as twitterTrends } from "@/app/api/trends/twitter/route"
import {
  getCachedJson,
  hashRedisKeyPart,
  setCachedJson,
} from "@/lib/redis/control-plane"
import {
  normalizedRequestCacheKey,
  readThroughJsonCache,
} from "@/lib/redis/json-cache"

jest.mock("@/lib/redis/control-plane", () => ({
  getCachedJson: jest.fn(),
  hashRedisKeyPart: jest.fn(),
  setCachedJson: jest.fn(),
}))

jest.mock("@/lib/redis/json-cache", () => ({
  normalizedRequestCacheKey: jest.fn(),
  readThroughJsonCache: jest.fn(),
}))

jest.mock("node:dns/promises", () => ({
  resolveMx: jest.fn(),
}))

const getCachedJsonMock = getCachedJson as jest.MockedFunction<
  typeof getCachedJson
>
const hashRedisKeyPartMock = hashRedisKeyPart as jest.MockedFunction<
  typeof hashRedisKeyPart
>
const setCachedJsonMock = setCachedJson as jest.MockedFunction<
  typeof setCachedJson
>
const normalizedRequestCacheKeyMock =
  normalizedRequestCacheKey as jest.MockedFunction<
    typeof normalizedRequestCacheKey
  >
const readThroughJsonCacheMock = readThroughJsonCache as jest.Mock
const resolveMxMock = dns.resolveMx as jest.MockedFunction<typeof dns.resolveMx>

function postRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`https://example.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function cacheMissesCompute() {
  readThroughJsonCacheMock.mockImplementation(async ({ compute }) => ({
    status: "computed",
    value: await compute(),
  }))
}

describe("provider response caching", () => {
  const originalTwitterToken = process.env.TWITTER_BEARER_TOKEN
  const originalRedditClientId = process.env.REDDIT_CLIENT_ID
  const originalRedditClientSecret = process.env.REDDIT_CLIENT_SECRET
  let consoleLogSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance
  let consoleWarnSpy: jest.SpyInstance

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation()
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.TWITTER_BEARER_TOKEN = "test-twitter-token"
    delete process.env.REDDIT_CLIENT_ID
    delete process.env.REDDIT_CLIENT_SECRET
    getCachedJsonMock.mockResolvedValue(null)
    hashRedisKeyPartMock.mockResolvedValue("client-id-hash")
    setCachedJsonMock.mockResolvedValue(true)
    normalizedRequestCacheKeyMock.mockImplementation(
      async (namespace, request) =>
        `${namespace}:${new URL(request.url).searchParams.toString()}`
    )
  })

  afterAll(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    if (originalTwitterToken === undefined) {
      delete process.env.TWITTER_BEARER_TOKEN
    } else {
      process.env.TWITTER_BEARER_TOKEN = originalTwitterToken
    }
    if (originalRedditClientId === undefined) {
      delete process.env.REDDIT_CLIENT_ID
    } else {
      process.env.REDDIT_CLIENT_ID = originalRedditClientId
    }
    if (originalRedditClientSecret === undefined) {
      delete process.env.REDDIT_CLIENT_SECRET
    } else {
      process.env.REDDIT_CLIENT_SECRET = originalRedditClientSecret
    }
  })

  it("does not read the cache for invalid provider inputs", async () => {
    const responses = await Promise.all([
      googleTrends(postRequest("/api/trends/google", { limit: 26 })),
      twitterTrends(postRequest("/api/trends/twitter", { woeid: 0 })),
      redditTrends(postRequest("/api/trends/reddit", { limit: 26 })),
      verifyMx(
        new NextRequest("https://example.test/api/dns/verify-mx?domain=invalid")
      ),
    ])

    expect(responses.map((response) => response.status)).toEqual([
      400, 400, 400, 400,
    ])
    expect(normalizedRequestCacheKeyMock).not.toHaveBeenCalled()
    expect(readThroughJsonCacheMock).not.toHaveBeenCalled()
  })

  it("serves Google trends from a canonical cached request", async () => {
    const cachedValue = {
      success: true,
      trends: [{ title: "Cached headline" }],
      metadata: { source: "google-news-rss-real" },
    }
    readThroughJsonCacheMock.mockResolvedValue({
      status: "hit",
      value: cachedValue,
    })

    const response = await googleTrends(
      postRequest("/api/trends/google", {
        limit: 3,
        geo: "us",
        hl: "EN",
        timeframe: " now 1-d ",
        segments: [{ name: " AI ", description: " Tools " }],
        unknown: "discarded",
      })
    )

    await expect(response.json()).resolves.toEqual(cachedValue)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(readThroughJsonCacheMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ttlSeconds: 180,
        lockTtlMs: 75_000,
        compute: expect.any(Function),
      })
    )
    const keyRequest = normalizedRequestCacheKeyMock.mock.calls[0][1]
    expect(
      JSON.parse(new URL(keyRequest.url).searchParams.get("input") || "")
    ).toEqual({
      geo: "US",
      hl: "en",
      timeframe: "now 1-d",
      limit: 3,
      segments: [{ name: "ai", description: "tools" }],
      mode: "news",
    })
  })

  it("does not cache an all-failed Google provider refresh", async () => {
    const computedValues: unknown[] = []
    readThroughJsonCacheMock.mockImplementation(async ({ compute }) => {
      const value = await compute()
      computedValues.push(value)
      return { status: "computed", value }
    })
    ;(global.fetch as jest.Mock).mockRejectedValue(
      new Error("Google provider unavailable")
    )
    jest.useFakeTimers()

    try {
      const responsePromise = googleTrends(
        postRequest("/api/trends/google", { limit: 1 })
      )
      await jest.runAllTimersAsync()
      const response = await responsePromise

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({
        success: true,
        trends: [],
      })
      expect(computedValues).toEqual([])
    } finally {
      jest.useRealTimers()
    }
  })

  it("checks Twitter credentials before reading the cache", async () => {
    delete process.env.TWITTER_BEARER_TOKEN

    const response = await twitterTrends(
      postRequest("/api/trends/twitter", {})
    )

    expect(response.status).toBe(503)
    expect(normalizedRequestCacheKeyMock).not.toHaveBeenCalled()
    expect(readThroughJsonCacheMock).not.toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("does not include the Twitter token in its cache key", async () => {
    const cachedValue = {
      success: true,
      trends: [],
      timestamp: "2026-09-21T00:00:00.000Z",
    }
    readThroughJsonCacheMock.mockResolvedValue({
      status: "hit",
      value: cachedValue,
    })

    const response = await twitterTrends(
      postRequest("/api/trends/twitter", { woeid: 1, limit: 5 })
    )

    await expect(response.json()).resolves.toEqual(cachedValue)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(normalizedRequestCacheKeyMock.mock.calls[0][1].url).not.toContain(
      "test-twitter-token"
    )
    expect(readThroughJsonCacheMock).toHaveBeenCalledWith(
      expect.objectContaining({ ttlSeconds: 180, lockTtlMs: 12_000 })
    )
  })

  it("keeps Twitter provider failures outside the cache", async () => {
    cacheMissesCompute()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 429,
    })

    const response = await twitterTrends(
      postRequest("/api/trends/twitter", {})
    )

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Twitter provider request failed",
    })
  })

  it("does not authenticate with Reddit on a response-cache hit", async () => {
    process.env.REDDIT_CLIENT_ID = "test-client-id"
    process.env.REDDIT_CLIENT_SECRET = "test-client-secret"
    const cachedValue = {
      success: true,
      trends: [],
      metadata: { source: "reddit-api" },
    }
    readThroughJsonCacheMock.mockResolvedValue({
      status: "hit",
      value: cachedValue,
    })

    const response = await redditTrends(
      postRequest("/api/trends/reddit", { subreddit: "all" })
    )

    await expect(response.json()).resolves.toEqual(cachedValue)
    expect(hashRedisKeyPartMock).not.toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
    expect(normalizedRequestCacheKeyMock.mock.calls[0][1].url).not.toContain(
      "test-client-secret"
    )
    expect(readThroughJsonCacheMock).toHaveBeenCalledWith(
      expect.objectContaining({ ttlSeconds: 180, lockTtlMs: 25_000 })
    )
  })

  it("keeps Reddit provider failures outside the cache", async () => {
    cacheMissesCompute()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
    })

    const response = await redditTrends(
      postRequest("/api/trends/reddit", {})
    )

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Reddit provider request failed",
    })
  })

  it("caches successful DNS answers longer than negative answers", async () => {
    cacheMissesCompute()
    resolveMxMock.mockResolvedValue([
      {
        exchange: "inbound-smtp.us-east-1.amazonaws.com",
        priority: 10,
      },
    ])

    const response = await verifyMx(
      new NextRequest(
        "https://example.test/api/dns/verify-mx?domain=EXAMPLE.COM"
      )
    )

    expect(response.status).toBe(200)
    expect(resolveMxMock).toHaveBeenCalledWith("example.com")
    expect(readThroughJsonCacheMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ttlSeconds: 60,
        lockTtlMs: 6_000,
        compute: expect.any(Function),
      })
    )
    expect(setCachedJsonMock).toHaveBeenCalledWith(
      expect.stringContaining(":positive"),
      expect.objectContaining({ success: true }),
      300
    )
  })

  it("serves a positive DNS cache hit without resolving again", async () => {
    const cachedValue = {
      success: true as const,
      verified: true,
      records: [
        {
          exchange: "inbound-smtp.us-east-1.amazonaws.com",
          priority: 10,
        },
      ],
    }
    getCachedJsonMock.mockResolvedValue(cachedValue)

    const response = await verifyMx(
      new NextRequest(
        "https://example.test/api/dns/verify-mx?domain=EXAMPLE.COM"
      )
    )

    await expect(response.json()).resolves.toEqual(cachedValue)
    expect(readThroughJsonCacheMock).not.toHaveBeenCalled()
    expect(resolveMxMock).not.toHaveBeenCalled()
  })

  it("uses the short cache for an unverified DNS answer", async () => {
    cacheMissesCompute()
    resolveMxMock.mockResolvedValue([
      { exchange: "mail.example.com", priority: 10 },
    ])

    const response = await verifyMx(
      new NextRequest(
        "https://example.test/api/dns/verify-mx?domain=example.com"
      )
    )

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      verified: false,
    })
    expect(readThroughJsonCacheMock).toHaveBeenCalledWith(
      expect.objectContaining({ ttlSeconds: 60 })
    )
    expect(setCachedJsonMock).not.toHaveBeenCalled()
  })

  it("caches only expected negative DNS answers", async () => {
    cacheMissesCompute()
    const notFound = Object.assign(new Error("queryMx ENOTFOUND example.com"), {
      code: "ENOTFOUND",
    })
    resolveMxMock.mockRejectedValue(notFound)

    const response = await verifyMx(
      new NextRequest(
        "https://example.test/api/dns/verify-mx?domain=example.com"
      )
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: false,
      verified: false,
      error: "queryMx ENOTFOUND example.com",
    })
    expect(setCachedJsonMock).not.toHaveBeenCalled()
  })

  it("does not turn unexpected DNS failures into cache values", async () => {
    const computedValues: unknown[] = []
    readThroughJsonCacheMock.mockImplementation(async ({ compute }) => {
      const value = await compute()
      computedValues.push(value)
      return { status: "computed", value }
    })
    const serviceFailure = Object.assign(new Error("temporary DNS failure"), {
      code: "ESERVFAIL",
    })
    resolveMxMock.mockRejectedValue(serviceFailure)

    const response = await verifyMx(
      new NextRequest(
        "https://example.test/api/dns/verify-mx?domain=example.com"
      )
    )

    expect(response.status).toBe(200)
    expect(computedValues).toEqual([])
    expect(setCachedJsonMock).not.toHaveBeenCalled()
  })
})
