/** @jest-environment node */

import { readThroughJsonCache } from "@/lib/redis/json-cache"
import { executeRedisCommand, isRedisConfigured, type RedisCommandResult } from "@/lib/redis/upstash-rest"

// Use real control-plane helpers to cover their boolean/null failure contracts.
// No credentials, environment files, or network requests are needed.
jest.mock("@/lib/redis/upstash-rest", () => ({
  executeRedisCommand: jest.fn(),
  isRedisConfigured: jest.fn(),
}))

const execute = jest.mocked(executeRedisCommand)
const configured = jest.mocked(isRedisConfigured)
const key = "cache:v1:tenant-a:user-a"
const reply = (result: unknown): RedisCommandResult<unknown> => ({ configured: true, result })

describe("JSON cache distributed lock contention and failure", () => {
  const originalRequired = process.env.REDIS_REQUIRED

  beforeEach(() => {
    jest.resetAllMocks()
    configured.mockReturnValue(true)
    delete process.env.REDIS_REQUIRED
  })

  afterEach(() => {
    if (originalRequired === undefined) delete process.env.REDIS_REQUIRED
    else process.env.REDIS_REQUIRED = originalRequired
  })

  it.each([undefined, "false", "true"])("never bypasses contention (REDIS_REQUIRED=%s)", async required => {
    if (required !== undefined) process.env.REDIS_REQUIRED = required
    execute.mockResolvedValue(reply(null))
    const compute = jest.fn(async () => ({ duplicate: true }))
    const options = { key, ttlSeconds: 60, compute }
    const first = readThroughJsonCache(options)
    const follower = readThroughJsonCache(options)
    await expect(Promise.all([first, follower])).resolves.toEqual([{ status: "busy" }, { status: "busy" }])
    // A later contender must not trigger recomputation either.
    await expect(readThroughJsonCache(options)).resolves.toEqual({ status: "busy" })
    expect(compute).not.toHaveBeenCalled()
    expect(execute.mock.calls.map(([command]) => command[0])).toEqual([
      "GET", "SET", "GET", "GET", "SET", "GET",
    ])
    expect(execute.mock.calls[0][0]).toEqual(["GET", key])
    expect(execute.mock.calls[1][0]).toEqual([
      "SET", `lock:${key}`, expect.any(String), "NX", "PX", 15_000,
    ])
    expect(execute.mock.calls[2][0]).toEqual(["GET", `${key}:stale`])
    expect(execute.mock.calls.some(([command]) => command[0] === "EVAL")).toBe(false)

    execute.mockResolvedValueOnce(reply(JSON.stringify({ winner: true })))
    await expect(readThroughJsonCache(options)).resolves.toEqual({
      status: "hit", value: { winner: true },
    })
    expect(compute).not.toHaveBeenCalled()
  })

  it.each([undefined, "false", "true"])("serves existing stale on contention (REDIS_REQUIRED=%s)", async required => {
    if (required !== undefined) process.env.REDIS_REQUIRED = required
    const value = { rows: ["previous"] }
    execute.mockResolvedValueOnce(reply(null))
      .mockResolvedValueOnce(reply(null))
      .mockResolvedValueOnce(reply(JSON.stringify(value)))
    const compute = jest.fn(async () => "unexpected")
    await expect(readThroughJsonCache({ key, ttlSeconds: 45, lockTtlMs: 30_000, compute })).resolves.toEqual({
      status: "stale", value,
    })
    expect(execute.mock.calls[1][0]).toEqual([
      "SET", `lock:${key}`, expect.any(String), "NX", "PX", 30_000,
    ])
    expect(execute).toHaveBeenCalledTimes(3)
    expect(compute).not.toHaveBeenCalled()
  })

  it.each([
    ["transport failure", { configured: true, error: "Redis request failed" }],
    ["configuration lost", { configured: false }],
    ["unexpected response", { configured: true, result: "unexpected" }],
  ] as const)("treats %s during acquire as busy, then cleans up for retry", async (_name, lockResponse) => {
    execute.mockResolvedValueOnce(reply(null))
      .mockResolvedValueOnce(lockResponse)
      .mockResolvedValueOnce(reply(null))
    const compute = jest.fn(async () => "unexpected")
    await expect(readThroughJsonCache({ key, ttlSeconds: 60, compute })).resolves.toEqual({ status: "busy" })
    expect(compute).not.toHaveBeenCalled()
    expect(execute).toHaveBeenCalledTimes(3)
    execute.mockResolvedValueOnce(reply(JSON.stringify("recovered")))
    await expect(readThroughJsonCache({ key, ttlSeconds: 60, compute })).resolves.toEqual({
      status: "hit", value: "recovered",
    })
  })

  it("serves stale rather than computing after an actual acquire failure", async () => {
    execute.mockResolvedValueOnce(reply(null))
      .mockResolvedValueOnce({ configured: true, error: "Redis returned HTTP 503" })
      .mockResolvedValueOnce(reply(JSON.stringify({ old: true })))
    const compute = jest.fn(async () => "unexpected")
    await expect(readThroughJsonCache({ key, ttlSeconds: 60, compute })).resolves.toEqual({
      status: "stale", value: { old: true },
    })
    expect(compute).not.toHaveBeenCalled()
  })

  it("does not compute when read failures also return null during an outage", async () => {
    execute.mockResolvedValue({ configured: true, error: "Redis request failed" })
    const compute = jest.fn(async () => "unexpected")
    await expect(readThroughJsonCache({ key, ttlSeconds: 60, compute })).resolves.toEqual({ status: "busy" })
    expect(compute).not.toHaveBeenCalled()
    expect(execute).toHaveBeenCalledTimes(3)
  })

  it("preserves optional write/release failure returns after an acquired lock", async () => {
    execute.mockResolvedValueOnce(reply(null))
      .mockResolvedValueOnce(reply("OK"))
      .mockResolvedValue({ configured: true, error: "Redis request failed" })
    const value = { rows: [1] }
    const compute = jest.fn(async () => value)
    const options = { key, ttlSeconds: 20, compute }
    await expect(readThroughJsonCache(options)).resolves.toEqual({ status: "computed", value })
    expect(execute.mock.calls[2][0]).toEqual(["SET", key, JSON.stringify(value), "EX", 20])
    expect(execute.mock.calls[3][0]).toEqual(["SET", `${key}:stale`, JSON.stringify(value), "EX", 100])
    const owner = execute.mock.calls[1][0][2]
    expect(execute.mock.calls[4][0]).toEqual(["EVAL", expect.any(String), 1, `lock:${key}`, owner])
    // Completion removes the local slot even when Redis helpers return false.
    execute.mockResolvedValueOnce(reply(JSON.stringify("next")))
    await expect(readThroughJsonCache(options)).resolves.toEqual({ status: "hit", value: "next" })
    expect(compute).toHaveBeenCalledTimes(1)
  })
})