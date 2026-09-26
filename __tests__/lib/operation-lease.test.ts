/** @jest-environment node */
import { acquireOperationLeaseResult, releaseLeasesWithStream } from '@/lib/redis/operation-lease'
import { acquireSemaphoreResult, hashRedisKeyPart, releaseSemaphore, renewSemaphore } from '@/lib/redis/control-plane'
import { isRedisConfigured } from '@/lib/redis/upstash-rest'

jest.mock('@/lib/redis/control-plane', () => ({
  acquireSemaphoreResult: jest.fn(), releaseSemaphore: jest.fn(), renewSemaphore: jest.fn(),
  hashRedisKeyPart: jest.fn(async () => 'resource-hash'),
}))
jest.mock('@/lib/redis/upstash-rest', () => ({ isRedisConfigured: jest.fn() }))

beforeEach(() => {
  jest.resetAllMocks()
  ;(hashRedisKeyPart as jest.Mock).mockResolvedValue('resource-hash')
  ;(isRedisConfigured as jest.Mock).mockReturnValue(true)
  ;(acquireSemaphoreResult as jest.Mock).mockResolvedValue('acquired')
  ;(releaseSemaphore as jest.Mock).mockResolvedValue(true)
  ;(renewSemaphore as jest.Mock).mockResolvedValue(true)
})
afterEach(() => jest.useRealTimers())

it('does not indefinitely extend a bounded assistant request lease', async () => {
  jest.useFakeTimers()
  const result = await acquireOperationLeaseResult('assistant-execution', 'instance', 815_000, 1, { renewAutomatically: false })
  expect(result.status).toBe('acquired')
  if (result.status !== 'acquired') throw new Error('Expected a lease')
  await jest.advanceTimersByTimeAsync(2_000_000)
  expect(renewSemaphore).not.toHaveBeenCalled()
  await result.lease.release()
  expect(await result.lease.renew()).toBe(false)
})

it('retries owner-scoped release and stops the heartbeat immediately', async () => {
  jest.useFakeTimers()
  ;(releaseSemaphore as jest.Mock).mockResolvedValueOnce(false).mockResolvedValueOnce(false)
  const result = await acquireOperationLeaseResult('export', 'site', 30_000)
  if (result.status !== 'acquired') throw new Error('Expected a lease')
  await Promise.all([result.lease.release(), result.lease.release()])
  expect(releaseSemaphore).toHaveBeenCalledTimes(3)
  const tokens = (releaseSemaphore as jest.Mock).mock.calls.map(call => call[1])
  expect(new Set(tokens).size).toBe(1)
  await jest.advanceTimersByTimeAsync(30_000)
  expect(renewSemaphore).not.toHaveBeenCalled()
})

it('cleans up only its own token after an ambiguous acquisition', async () => {
  ;(acquireSemaphoreResult as jest.Mock).mockResolvedValue('unavailable')
  expect(await acquireOperationLeaseResult('assistant-execution', 'instance', 815_000)).toEqual({ status: 'unavailable' })
  const [key, owner] = (acquireSemaphoreResult as jest.Mock).mock.calls[0]
  expect(releaseSemaphore).toHaveBeenCalledWith(key, owner)
  expect(renewSemaphore).not.toHaveBeenCalled()
})

it('does not release the active owner on contention', async () => {
  ;(acquireSemaphoreResult as jest.Mock).mockResolvedValue('contended')
  expect(await acquireOperationLeaseResult('assistant-execution', 'instance', 815_000)).toEqual({ status: 'contended' })
  expect(releaseSemaphore).not.toHaveBeenCalled()
})

it('fails closed for invalid Redis configuration even when Redis is optional', async () => {
  const previous = process.env.REDIS_URL
  process.env.REDIS_URL = 'invalid'
  ;(isRedisConfigured as jest.Mock).mockReturnValue(false)
  try {
    expect(await acquireOperationLeaseResult('assistant-execution', 'instance', 815_000)).toEqual({ status: 'unavailable' })
  } finally {
    if (previous === undefined) delete process.env.REDIS_URL
    else process.env.REDIS_URL = previous
  }
})

it('allows another request after actual stream EOF releases the first owner', async () => {
  let occupied = false
  ;(acquireSemaphoreResult as jest.Mock).mockImplementation(async () => {
    if (occupied) return 'contended'
    occupied = true
    return 'acquired'
  })
  ;(releaseSemaphore as jest.Mock).mockImplementation(async () => { occupied = false; return true })
  const first = await acquireOperationLeaseResult('assistant-execution', 'instance', 30_000)
  if (first.status !== 'acquired') throw new Error('Expected a lease')
  expect((await acquireOperationLeaseResult('assistant-execution', 'instance', 30_000)).status).toBe('contended')
  const body = releaseLeasesWithStream(new Response('done').body, [first.lease])
  expect(await new Response(body).text()).toBe('done')
  const second = await acquireOperationLeaseResult('assistant-execution', 'instance', 30_000)
  expect(second.status).toBe('acquired')
  if (second.status === 'acquired') await second.lease.release()
})

it('releases a cancelled stream before a stalled upstream cancellation finishes', async () => {
  const release = jest.fn().mockResolvedValue(undefined)
  const cancel = jest.fn(() => new Promise<void>(() => {}))
  const body = releaseLeasesWithStream(new ReadableStream({ cancel }), [{ release, renew: async () => true }])!
  await body.cancel()
  expect(release).toHaveBeenCalledTimes(1)
  expect(cancel).toHaveBeenCalledTimes(1)
})

it('releases on request abort even without a downstream read', async () => {
  const release = jest.fn().mockResolvedValue(undefined)
  const abort = new AbortController()
  const body = releaseLeasesWithStream(new ReadableStream(), [{ release, renew: async () => true }], { signal: abort.signal })!
  abort.abort(new Error('client disconnected'))
  await expect(body.getReader().read()).rejects.toThrow('client disconnected')
  expect(release).toHaveBeenCalledTimes(1)
})

it('releases an errored stream and a missing response body', async () => {
  const release = jest.fn().mockResolvedValue(undefined)
  const lease = { release, renew: async () => true }
  const body = releaseLeasesWithStream(new ReadableStream({ start(c) { c.error(new Error('broken')) } }), [lease])!
  await expect(new Response(body).text()).rejects.toThrow('broken')
  expect(release).toHaveBeenCalledTimes(1)
  expect(releaseLeasesWithStream(null, [lease])).toBeNull()
  expect(release).toHaveBeenCalledTimes(2)
})