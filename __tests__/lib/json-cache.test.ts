/** @jest-environment node */

import { createHash } from "node:crypto"
import {
  acquireLock,
  getCachedJson,
  hashRedisKeyPart,
  releaseLock,
  setCachedJson,
} from "@/lib/redis/control-plane"
import { normalizedRequestCacheKey, readThroughJsonCache } from "@/lib/redis/json-cache"
import { isRedisConfigured } from "@/lib/redis/upstash-rest"

jest.mock("@/lib/redis/control-plane", () => ({
  acquireLock: jest.fn(),
  getCachedJson: jest.fn(),
  hashRedisKeyPart: jest.fn(),
  releaseLock: jest.fn(),
  setCachedJson: jest.fn(),
}))
jest.mock("@/lib/redis/upstash-rest", () => ({ isRedisConfigured: jest.fn() }))

const configured = jest.mocked(isRedisConfigured)
const get = jest.mocked(getCachedJson)
const acquire = jest.mocked(acquireLock)
const set = jest.mocked(setCachedJson)
const release = jest.mocked(releaseLock)

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

// Drain pending microtasks without time-based sleeps or reaching Redis.
const drain = () => new Promise<void>(resolve => setImmediate(resolve))
async function expectPending(promise: Promise<unknown>) {
  let settled = false
  void promise.then(() => { settled = true }, () => { settled = true })
  await drain()
  expect(settled).toBe(false)
}
const options = (compute: () => Promise<unknown>, key = "cache:v1:site-a:user-a") => ({
  key, ttlSeconds: 60, compute,
})

describe("readThroughJsonCache local single-flight", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    configured.mockReturnValue(true)
    get.mockResolvedValue(null)
    acquire.mockResolvedValue(true)
    set.mockResolvedValue(true)
    release.mockResolvedValue(true)
    jest.mocked(hashRedisKeyPart).mockImplementation(async value =>
      createHash("sha256").update(value).digest("hex")
    )
  })

  it.each([false, true])("coalesces a burst before configuration (configured=%s)", async enabled => {
    configured.mockReturnValue(enabled)
    const work = deferred<unknown>()
    const compute = jest.fn(() => work.promise)
    const first = readThroughJsonCache(options(compute))
    const duplicateCompute = jest.fn(async () => ({ wrong: true }))
    const followers = Array.from({ length: 20 }, () => readThroughJsonCache({
      ...options(duplicateCompute), ttlSeconds: 1, lockTtlMs: 1,
    }))

    expect(configured).not.toHaveBeenCalled()
    expect(compute).not.toHaveBeenCalled()
    for (const follower of followers) expect(follower).not.toBe(first)
    await drain()
    expect(configured).toHaveBeenCalledTimes(1)
    expect(compute).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledTimes(enabled ? 1 : 0)
    const value = { rows: [1] }
    work.resolve(value)
    expect(await Promise.all([first, ...followers])).toEqual(
      Array.from({ length: 21 }, () => ({ status: "computed", value }))
    )
    expect(duplicateCompute).not.toHaveBeenCalled()
    expect(set).toHaveBeenCalledTimes(enabled ? 2 : 0)
    if (enabled) {
      expect(set).toHaveBeenCalledWith("cache:v1:site-a:user-a", value, 60)
      expect(set).toHaveBeenCalledWith("cache:v1:site-a:user-a:stale", value, 300)
      const [lockKey, token] = acquire.mock.calls[0]
      expect(acquire).toHaveBeenCalledWith(`lock:cache:v1:site-a:user-a`, token, 15_000)
      expect(release).toHaveBeenCalledWith(lockKey, token)
    }
  })

  it("shares a pending cache read and hit, then reads again after settlement", async () => {
    const read = deferred<unknown>()
    get.mockReturnValueOnce(read.promise)
    const compute = jest.fn(async () => "unexpected")
    const first = readThroughJsonCache(options(compute))
    await drain()
    await expectPending(readThroughJsonCache(options(compute)))
    expect(get).toHaveBeenCalledTimes(1)
    read.resolve({ fresh: true })
    await expect(first).resolves.toEqual({ status: "hit", value: { fresh: true } })
    expect(acquire).not.toHaveBeenCalled()
    get.mockResolvedValueOnce({ newer: true })
    await expect(readThroughJsonCache(options(compute))).resolves.toEqual({
      status: "hit", value: { newer: true },
    })
    expect(get).toHaveBeenCalledTimes(2)
    expect(compute).not.toHaveBeenCalled()
  })

  it("snapshots options so caller mutations cannot redirect pending work to another key", async () => {
    const compute = jest.fn(async () => "original")
    const requestOptions = options(compute, "cache:site-a:user-a")
    const before = { ...requestOptions }
    const first = readThroughJsonCache(requestOptions)
    expect(requestOptions).toEqual(before)
    requestOptions.key = "cache:site-b:user-b"
    requestOptions.ttlSeconds = 1
    requestOptions.compute = jest.fn(async () => "wrong")
    await expect(first).resolves.toEqual({ status: "computed", value: "original" })
    expect(get).toHaveBeenCalledWith(before.key)
    expect(set).toHaveBeenCalledWith(before.key, "original", 60)
    expect(set).toHaveBeenCalledWith(`${before.key}:stale`, "original", 300)
    expect(requestOptions.compute).not.toHaveBeenCalled()
  })

  it.each(["computed", "hit", "stale"])("isolates same-key %s values from caller mutations", async status => {
    const value = { rows: [{ name: "original" }] }
    if (status === "hit") get.mockResolvedValue(value)
    if (status === "stale") {
      get.mockResolvedValueOnce(null).mockResolvedValueOnce(value)
      acquire.mockResolvedValue(false)
    }
    const compute = jest.fn(async () => value)
    const requestOptions = options(compute)
    const [a, b] = await Promise.all([
      readThroughJsonCache(requestOptions), readThroughJsonCache(requestOptions),
    ])
    expect(a.status).toBe(status)
    expect(b.status).toBe(status)
    if (a.status === "busy" || b.status === "busy") throw new Error("unexpected busy")
    expect(a).not.toBe(b)
    expect(a.value).not.toBe(b.value)
    ;(a.value as typeof value).rows[0].name = "changed"
    expect(b.value).toEqual({ rows: [{ name: "original" }] })
    expect(value).toEqual({ rows: [{ name: "original" }] })
    expect(compute).toHaveBeenCalledTimes(status === "computed" ? 1 : 0)
  })

  it.each([false, true])("keeps exact keys independent, without cross-key mutation (configured=%s)", async enabled => {
    configured.mockReturnValue(enabled)
    const workA = deferred<unknown>()
    const workB = deferred<unknown>()
    const computeA = jest.fn(() => workA.promise)
    const computeB = jest.fn(() => workB.promise)
    const first = readThroughJsonCache(options(computeA, "cache:site-a:user-a"))
    const otherUser = readThroughJsonCache(options(computeB, "cache:site-a:user-b"))
    const otherTenant = readThroughJsonCache(options(async () => ({ rows: ["tenant"] }), "cache:site-b:user-a"))
    expect(otherUser).not.toBe(first)
    await expect(otherTenant).resolves.toMatchObject({ value: { rows: ["tenant"] } })
    await drain()
    expect(computeA).toHaveBeenCalledTimes(1)
    expect(computeB).toHaveBeenCalledTimes(1)
    workB.resolve({ rows: ["B"] })
    const resultB = await otherUser
    if (resultB.status !== "busy") (resultB.value as { rows: string[] }).rows.push("changed")
    await expectPending(readThroughJsonCache(options(computeA, "cache:site-a:user-a")))
    expect(computeA).toHaveBeenCalledTimes(1)
    workA.resolve({ rows: ["A"] })
    await expect(first).resolves.toEqual({ status: "computed", value: { rows: ["A"] } })
  })

  it("isolates stale, hit, and computed results by exact key", async () => {
    const stale = { rows: ["old"] }
    const fresh = { rows: ["fresh"] }
    get.mockImplementation(async key => key === "cache:a:stale" ? stale : key === "cache:b" ? fresh : null)
    acquire.mockImplementation(async key => key !== "lock:cache:a")
    const forbidden = jest.fn(async () => "unexpected")
    const a = readThroughJsonCache(options(forbidden, "cache:a"))
    const aFollower = readThroughJsonCache(options(forbidden, "cache:a"))
    const b = readThroughJsonCache(options(forbidden, "cache:b"))
    const c = readThroughJsonCache(options(async () => ({ rows: ["new"] }), "cache:c"))
    await expect(a).resolves.toEqual({ status: "stale", value: stale })
    await expect(aFollower).resolves.toEqual({ status: "stale", value: stale })
    await expect(b).resolves.toEqual({ status: "hit", value: fresh })
    await expect(c).resolves.toEqual({ status: "computed", value: { rows: ["new"] } })
    expect(forbidden).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledTimes(1)
    expect(release.mock.calls[0][0]).toBe("lock:cache:c")
    expect(set.mock.calls.map(([key]) => key)).toEqual(["cache:c", "cache:c:stale"])
  })

  it.each([false, true])("removes rejected compute slots for retry (configured=%s)", async enabled => {
    configured.mockReturnValue(enabled)
    const work = deferred<unknown>()
    const compute = jest.fn(() => work.promise)
    const first = readThroughJsonCache(options(compute))
    const follower = readThroughJsonCache(options(compute))
    const results = Promise.allSettled([first, follower])
    const failure = new Error("compute failed")
    work.reject(failure)
    expect(await results).toEqual([
      { status: "rejected", reason: failure }, { status: "rejected", reason: failure },
    ])
    expect(compute).toHaveBeenCalledTimes(1)
    expect(set).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledTimes(enabled ? 1 : 0)
    await expect(readThroughJsonCache(options(async () => "retry"))).resolves.toEqual({
      status: "computed", value: "retry",
    })
  })

  it("does not retain computed data when Redis is unconfigured", async () => {
    configured.mockReturnValue(false)
    const compute = jest.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second")
    await expect(readThroughJsonCache(options(compute))).resolves.toMatchObject({ value: "first" })
    await expect(readThroughJsonCache(options(compute))).resolves.toMatchObject({ value: "second" })
    expect(compute).toHaveBeenCalledTimes(2)
  })

  it("never evicts running work when many independent keys arrive", async () => {
    configured.mockReturnValue(false)
    const work = deferred<unknown>()
    const compute = jest.fn(() => work.promise)
    const pending = Array.from({ length: 600 }, (_, index) =>
      readThroughJsonCache(options(compute, `cache:site-${index}:user-a`))
    )
    await drain()
    const follower = readThroughJsonCache(options(compute, "cache:site-0:user-a"))
    await expectPending(follower)
    expect(compute).toHaveBeenCalledTimes(600)
    work.resolve("done")
    await Promise.all([...pending, follower])
  })

  it.each(["configuration", "read", "acquire", "stale read", "write", "release"])(
    "cleans up after a %s rejection", async stage => {
      const failure = new Error(`${stage} failed`)
      if (stage === "configuration") configured.mockImplementationOnce(() => { throw failure })
      if (stage === "read") get.mockRejectedValueOnce(failure)
      if (stage === "acquire") acquire.mockRejectedValueOnce(failure)
      if (stage === "stale read") {
        acquire.mockResolvedValueOnce(false)
        get.mockResolvedValueOnce(null).mockRejectedValueOnce(failure)
      }
      if (stage === "write") set.mockRejectedValueOnce(failure)
      if (stage === "release") release.mockRejectedValueOnce(failure)
      const compute = jest.fn(async () => "value")
      const first = readThroughJsonCache(options(compute))
      const follower = readThroughJsonCache(options(compute))
      expect(await Promise.allSettled([first, follower])).toEqual([
        { status: "rejected", reason: failure }, { status: "rejected", reason: failure },
      ])
      if (stage === "write" || stage === "release") expect(release).toHaveBeenCalledTimes(1)
      else expect(compute).not.toHaveBeenCalled()
      await expect(readThroughJsonCache(options(compute))).resolves.toMatchObject({ status: "computed" })
    }
  )

  it.each([false, true])("retains the slot until both writes and release settle (write rejection=%s)", async rejectWrite => {
    const freshWrite = deferred<boolean>()
    const staleWrite = deferred<boolean>()
    const unlocking = deferred<boolean>()
    set.mockReturnValueOnce(freshWrite.promise).mockReturnValueOnce(staleWrite.promise)
    release.mockReturnValueOnce(unlocking.promise)
    const compute = jest.fn(async () => "value")
    const first = readThroughJsonCache(options(compute))
    const result = Promise.allSettled([first])
    await drain()
    expect(set).toHaveBeenCalledTimes(2)
    const failure = new Error("write failed")
    if (rejectWrite) freshWrite.reject(failure)
    else freshWrite.resolve(true)
    await drain()
    expect(release).not.toHaveBeenCalled()
    await expectPending(readThroughJsonCache(options(compute)))
    expect(compute).toHaveBeenCalledTimes(1)
    staleWrite.resolve(true)
    await drain()
    expect(release).toHaveBeenCalledTimes(1)
    await expectPending(readThroughJsonCache(options(compute)))
    expect(compute).toHaveBeenCalledTimes(1)
    unlocking.resolve(true)
    expect(await result).toEqual(rejectWrite
      ? [{ status: "rejected", reason: failure }]
      : [{ status: "fulfilled", value: { status: "computed", value: "value" } }])
    await expect(readThroughJsonCache(options(compute))).resolves.toMatchObject({ status: "computed" })
    expect(compute).toHaveBeenCalledTimes(2)
  })

  it("retains rejected computation until lock release finishes", async () => {
    const unlocking = deferred<boolean>()
    release.mockReturnValueOnce(unlocking.promise)
    const failure = new Error("compute failed")
    const compute = jest.fn(async () => { throw failure })
    const first = readThroughJsonCache(options(compute))
    const result = Promise.allSettled([first])
    await drain()
    await expectPending(readThroughJsonCache(options(compute)))
    expect(compute).toHaveBeenCalledTimes(1)
    unlocking.resolve(true)
    expect(await result).toEqual([{ status: "rejected", reason: failure }])
    await expect(readThroughJsonCache(options(async () => "retry"))).resolves.toMatchObject({ value: "retry" })
  })

  it("preserves canonical namespace, user, tenant, and query key boundaries", async () => {
    const request = new Request("https://example.test/api?siteId=site-a&end=2&start=1")
    const first = await normalizedRequestCacheKey("dashboard:user-a", request)
    expect(first).toBe(`cache:v1:dashboard:user-a:${createHash("sha256")
      .update("dashboard:user-a:end=2&siteId=site-a&start=1").digest("hex")}`)
    expect(await normalizedRequestCacheKey("dashboard:user-a", new Request(
      "https://example.test/api?start=1&siteId=site-a&end=2"
    ))).toBe(first)
    for (const [namespace, url] of [
      ["dashboard:user-b", request.url],
      ["dashboard:user-a", "https://example.test/api?start=1&siteId=site-b&end=2"],
      ["dashboard:user-a", "https://example.test/api?start=3&siteId=site-a&end=2"],
    ]) expect(await normalizedRequestCacheKey(namespace, new Request(url))).not.toBe(first)
  })
})