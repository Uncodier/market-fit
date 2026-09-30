/** @jest-environment node */

import { POST } from '@/app/api/commerce/visitor-session/route'
import { getShopSite } from '@/app/shop/[siteSlug]/actions'
import { checkRateLimit } from '@/lib/redis/control-plane'

jest.mock('@/app/shop/[siteSlug]/actions', () => ({ getShopSite: jest.fn() }))
jest.mock('@/lib/redis/control-plane', () => ({
  ...jest.requireActual('@/lib/redis/control-plane'), checkRateLimit: jest.fn(), hashRedisKeyPart: jest.fn(async () => 'ip-hash'),
}))

const siteId = '00000000-0000-4000-8000-000000000001'
const visitorId = '00000000-0000-4000-8000-000000000002'
const sessionId = '00000000-0000-4000-8000-000000000003'
const env = { ...process.env }
const session = () => ({ success: true, data: {
  site_id: siteId, visitor_id: visitorId, session_id: sessionId, session_token: 'visitor-proof', expires_at: Date.now() + 1800_000, ttl: 1800,
} })

function request(body: Record<string, unknown> = {}, headers: Record<string, string> = {}, origin = 'https://www.makinari.com') {
  return new Request('https://www.makinari.com/api/commerce/visitor-session', {
    method: 'POST', headers: { origin, 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', ...headers },
    body: JSON.stringify({ site_id: siteId, url: `${origin}/shop/coffee?secret=private#token`, ...body }),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = 'https://api.example.test'
  process.env.SERVICE_API_KEY = 'server-only-key'
  jest.mocked(checkRateLimit).mockResolvedValue({ allowed: true, limit: 20, remaining: 19, resetMs: 60_000 })
  jest.mocked(getShopSite).mockResolvedValue({ id: siteId, name: 'Shop', logo_url: null })
  jest.mocked(fetch).mockReset().mockResolvedValue(Response.json(session()))
})
afterAll(() => { process.env = env })

it('mints only a new anonymous public-site session and exposes only the visitor proof', async () => {
  const response = await POST(request({ referrer: 'https://search.test/results?q=private#token' }, {
    authorization: 'Bearer forged', 'x-api-key': 'forged', 'x-visitor-session-token': 'other-proof', cookie: 'session',
  }))
  expect(response.status).toBe(201)
  expect(response.headers.get('cache-control')).toBe('no-store, private')
  const result = await response.json()
  expect(result.data).toMatchObject({ site_id: siteId, visitor_id: visitorId, session_id: sessionId, session_token: 'visitor-proof' })
  expect(JSON.stringify(result)).not.toContain('server-only-key')
  expect(getShopSite).toHaveBeenCalledWith(siteId)
  const [url, options] = jest.mocked(fetch).mock.calls[0]
  expect(String(url)).toBe('https://api.example.test/api/visitors/session')
  expect(options?.headers).toEqual({ 'Content-Type': 'application/json', Accept: 'application/json', 'x-api-key': 'server-only-key' })
  expect(options).toMatchObject({ cache: 'no-store', redirect: 'error', credentials: 'omit' })
  expect(JSON.parse(String(options?.body))).toEqual({ site_id: siteId, url: 'https://www.makinari.com/shop/coffee', referrer: 'https://search.test/results' })
  expect(jest.mocked(getShopSite).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(fetch).mock.invocationCallOrder[0])
})

it('supports the exact www-to-app rewrite without allowing an unrelated browser origin', async () => {
  const source = request()
  const rewritten = new Request('https://app.makinari.com/api/commerce/visitor-session', {
    method: 'POST', headers: source.headers, body: await source.text(),
  })
  expect((await POST(rewritten)).status).toBe(201)
  expect((await POST(request({}, {}, 'https://evil.test'))).status).toBe(403)
})

it.each([false, true])('fails closed before accessing the site when rate admission fails (unavailable=%s)', async unavailable => {
  jest.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, limit: 20, remaining: 0, resetMs: 60_000, unavailable })
  expect((await POST(request())).status).toBe(unavailable ? 503 : 429)
  expect(getShopSite).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it('does not create sessions for missing, archived or mismatched public sites', async () => {
  for (const site of [null, { id: visitorId, name: 'Other', logo_url: null }]) {
    jest.mocked(getShopSite).mockResolvedValueOnce(site)
    expect((await POST(request())).status).toBe(404)
  }
  expect(fetch).not.toHaveBeenCalled()
})

it('rejects takeover IDs, forged source URLs, invalid origins and oversized input', async () => {
  for (const body of [{ visitor_id: visitorId }, { id: visitorId }, { previous_session_id: sessionId },
    { session_id: sessionId }, { user_id: visitorId }, { target: 'https://evil.test' }, { site_id: 'bad' },
    { url: 'https://evil.test/shop/test' }, { url: 'https://www.makinari.com/settings' }]) {
    expect((await POST(request(body))).status).toBe(400)
  }
  expect((await POST(request({}, { origin: '' }))).status).toBe(403)
  expect((await POST(request({}, { 'sec-fetch-site': 'cross-site' }))).status).toBe(403)
  expect((await POST(request({}, { 'content-type': 'text/plain' }))).status).toBe(415)
  expect((await POST(request({ url: 'x'.repeat(9000) }))).status).toBe(413)
  expect(getShopSite).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it('fails closed when server credentials or trusted destination are unavailable', async () => {
  delete process.env.SERVICE_API_KEY
  expect((await POST(request())).status).toBe(503)
  process.env.SERVICE_API_KEY = 'server-only-key'
  process.env.API_SERVER_URL = 'https://user:password@api.example.test'
  expect((await POST(request())).status).toBe(503)
  expect(fetch).not.toHaveBeenCalled()
})

it('sanitizes upstream failures and never retries an ambiguous creation', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ error: 'secret provider details' }, { status: 403 }))
  const response = await POST(request())
  expect(response.status).toBe(403)
  expect(await response.text()).not.toContain('secret provider details')
  jest.mocked(fetch).mockRejectedValueOnce(new Error('network'))
  expect((await POST(request())).status).toBe(503)
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('rejects malformed, expired and cross-site session responses', async () => {
  const valid = session()
  for (const body of [{ success: true }, { ...valid, data: { ...valid.data, site_id: visitorId } },
    { ...valid, data: { ...valid.data, expires_at: 1 } }]) {
    jest.mocked(fetch).mockResolvedValueOnce(Response.json(body))
    expect((await POST(request())).status).toBe(502)
  }
  expect(fetch).toHaveBeenCalledTimes(3)
})