/** @jest-environment node */
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/trends/reddit/route'
import { readThroughJsonCache } from '@/lib/redis/json-cache'

jest.mock('@/lib/redis/control-plane', () => ({ getCachedJson: jest.fn(async () => null),
  hashRedisKeyPart: jest.fn(async () => 'synthetic-hash'), setCachedJson: jest.fn(async () => true) }))
jest.mock('@/lib/redis/json-cache', () => ({ normalizedRequestCacheKey: jest.fn(async () => 'synthetic-key'), readThroughJsonCache: jest.fn() }))

const originalEnv = process.env
const persisted: unknown[] = []
const request = (body = '{}') => new NextRequest('http://localhost:3000/api/trends/reddit', { method: 'POST', body })
beforeEach(() => {
  jest.clearAllMocks()
  persisted.length = 0
  process.env = { NODE_ENV: 'test' }
  jest.spyOn(console, 'log').mockImplementation()
  jest.spyOn(console, 'warn').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
  jest.mocked(readThroughJsonCache).mockImplementation(async options => {
    const value = await options.compute()
    persisted.push(value)
    return { status: 'computed', value }
  })
})
afterEach(() => { process.env = originalEnv; jest.restoreAllMocks() })

async function expectProviderFailure() {
  const response = await POST(request())
  expect(response.status).toBe(502)
  await expect(response.json()).resolves.toEqual({ success: false, error: 'Reddit provider request failed' })
  expect(persisted).toEqual([])
  expect(JSON.stringify(jest.mocked(console.warn).mock.calls)).not.toContain('synthetic-private')
}

it.each(['transport', 'timeout', 'invalid-json', 'invalid-shape', 'http'])(
  'reports a %s listing failure as a sanitized dependency error, not a bad client request', async kind => {
    jest.mocked(fetch).mockReset()
    if (kind === 'transport' || kind === 'timeout') jest.mocked(fetch).mockRejectedValue(new Error('synthetic-private-provider-detail'))
    else if (kind === 'http') jest.mocked(fetch).mockResolvedValue({ ok: false, status: 403 } as Response)
    else jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => {
      if (kind === 'invalid-json') throw new SyntaxError('synthetic-private-token')
      return { data: { children: [{ data: { title: 'incomplete' } }] } }
    } } as Response)
    await expectProviderFailure()
    expect(fetch).toHaveBeenCalledTimes(1)
  },
)
it('does not silently fall back to public Reddit after configured OAuth rejection', async () => {
  process.env.REDDIT_CLIENT_ID = 'synthetic-client'
  process.env.REDDIT_CLIENT_SECRET = 'synthetic-private-secret'
  jest.mocked(fetch).mockReset().mockResolvedValue({ ok: false, status: 401 } as Response)
  await expectProviderFailure()
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(jest.mocked(fetch).mock.calls[0][0]).toBe('https://www.reddit.com/api/v1/access_token')
})
it('rejects incomplete OAuth configuration without any outbound request', async () => {
  process.env.REDDIT_CLIENT_ID = 'synthetic-client'
  jest.mocked(fetch).mockReset()
  await expectProviderFailure()
  expect(fetch).not.toHaveBeenCalled()
})
it('keeps malformed client JSON as 400 without contacting Reddit', async () => {
  jest.mocked(fetch).mockReset()
  const response = await POST(request('{broken'))
  expect(response.status).toBe(400)
  expect(fetch).not.toHaveBeenCalled()
})
it('still accepts a confirmed empty successful listing and forbids following redirects', async () => {
  jest.mocked(fetch).mockReset().mockResolvedValue({ ok: true, json: async () => ({ data: { children: [] } }) } as Response)
  const response = await POST(request())
  expect(response.status).toBe(200)
  await expect(response.json()).resolves.toMatchObject({ success: true, trends: [] })
  expect(persisted).toHaveLength(1)
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('https://www.reddit.com/r/'), expect.objectContaining({ redirect: 'error' }))
})