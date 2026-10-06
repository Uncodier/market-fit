/** @jest-environment node */

import { OPTIONS, POST } from '@/app/api/commerce/visitor-session/route'
import { getShopSite } from '@/app/shop/[siteSlug]/actions'
import { checkRateLimit } from '@/lib/redis/control-plane'

jest.mock('@/app/shop/[siteSlug]/actions', () => ({ getShopSite: jest.fn() }))
jest.mock('@/lib/redis/control-plane', () => ({
  ...jest.requireActual('@/lib/redis/control-plane'), checkRateLimit: jest.fn(), hashRedisKeyPart: jest.fn(async () => 'ip-hash'),
}))

const env = { ...process.env }
const siteId = '00000000-0000-4000-8000-000000000001'
const endpoint = 'https://app.makinari.com/api/commerce/visitor-session'

function preflight(headers: Record<string, string | undefined> = {}, url = endpoint) {
  const definedHeaders = Object.fromEntries(Object.entries(headers)
    .filter((entry): entry is [string, string] => entry[1] !== undefined))
  return new Request(url, { method: 'OPTIONS', headers: {
    origin: 'https://www.makinari.com', 'sec-fetch-site': 'same-site',
    'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type', ...definedHeaders,
  } })
}

function post(body: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return new Request(endpoint, { method: 'POST', headers: {
    origin: 'https://www.makinari.com', 'sec-fetch-site': 'same-site', 'content-type': 'application/json', ...headers,
  }, body: JSON.stringify({ site_id: siteId, url: 'https://www.makinari.com/shop/coffee?token=private#secret', ...body }) })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = 'https://api.example.test'
  process.env.SERVICE_API_KEY = 'server-only-key'
  jest.mocked(checkRateLimit).mockResolvedValue({ allowed: true, limit: 20, remaining: 19, resetMs: 60_000 })
  jest.mocked(getShopSite).mockResolvedValue({ id: siteId, name: 'Shop', logo_url: null })
  jest.mocked(fetch).mockReset().mockResolvedValue(Response.json({ success: true, data: {
    site_id: siteId, visitor_id: '00000000-0000-4000-8000-000000000002',
    session_id: '00000000-0000-4000-8000-000000000003', session_token: 'visitor-proof',
    expires_at: Date.now() + 1800_000, ttl: 1800,
  } }))
})
afterAll(() => { process.env = env })

it.each(['https://www.makinari.com', 'https://makinari.com'])(
  'allows only anonymous JSON POST preflight from %s to the canonical app origin', origin => {
    const response = OPTIONS(preflight({ origin, 'access-control-request-headers': 'Content-Type' }))
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe(origin)
    expect(response.headers.get('access-control-allow-methods')).toBe('POST')
    expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type')
    expect(response.headers.get('access-control-allow-credentials')).toBeNull()
    expect(response.headers.get('vary')).toBe('Origin')
    expect(response.headers.get('cache-control')).toBe('no-store, private')
    expect(getShopSite).not.toHaveBeenCalled()
    expect(checkRateLimit).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  },
)

it.each([
  { origin: 'https://evil.test' }, { origin: 'https://www.makinari.com.evil.test' }, { origin: 'null' },
  { origin: 'http://www.makinari.com' }, { origin: '' }, { 'sec-fetch-site': 'cross-site' },
  { 'access-control-request-method': 'PUT' }, { 'access-control-request-method': '' },
  { 'access-control-request-headers': 'Content-Type, Authorization' },
  { 'access-control-request-headers': 'x-api-key' },
  { 'access-control-request-headers': 'x-visitor-session-token' },
])('denies untrusted or credential-bearing preflight: %j', headers => {
  const response = OPTIONS(preflight(headers))
  expect(response.status).toBe(403)
  expect(response.headers.get('access-control-allow-origin')).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
})

it('does not enable direct delivery on previews, loopback or an unrelated destination', () => {
  for (const origin of ['https://preview.makinari.com', 'http://localhost:3000', 'https://evil.test']) {
    expect(OPTIONS(preflight({}, `${origin}/api/commerce/visitor-session`)).status).toBe(403)
  }
})

it('returns a proof through narrow CORS while preserving authorization and stripped attribution', async () => {
  const response = await POST(post({}, { authorization: 'Bearer forged', 'x-api-key': 'forged' }))
  expect(response.status).toBe(201)
  expect(response.headers.get('access-control-allow-origin')).toBe('https://www.makinari.com')
  expect(response.headers.get('access-control-allow-credentials')).toBeNull()
  expect(getShopSite).toHaveBeenCalledWith(siteId)
  const [target, options] = jest.mocked(fetch).mock.calls[0]
  expect(String(target)).toBe('https://api.example.test/api/visitors/session')
  expect(options?.headers).toEqual({ 'Content-Type': 'application/json', Accept: 'application/json', 'x-api-key': 'server-only-key' })
  expect(JSON.parse(String(options?.body))).toEqual({ site_id: siteId, url: 'https://www.makinari.com/shop/coffee' })
  expect(await response.text()).not.toContain('server-only-key')
})

it('keeps errors observable to an allowed caller without admitting missing sites or takeover IDs', async () => {
  expect((await POST(post({ visitor_id: siteId }))).status).toBe(400)
  jest.mocked(getShopSite).mockResolvedValueOnce(null)
  const missing = await POST(post())
  expect(missing.status).toBe(404)
  expect(missing.headers.get('access-control-allow-origin')).toBe('https://www.makinari.com')
  jest.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, limit: 20, remaining: 0, resetMs: 60_000 })
  const limited = await POST(post())
  expect(limited.status).toBe(429)
  expect(limited.headers.get('access-control-allow-origin')).toBe('https://www.makinari.com')
  expect(limited.headers.get('vary')).toContain('Origin')
  expect(fetch).not.toHaveBeenCalled()
})

it('rejects untrusted POST origins without reflecting them in CORS', async () => {
  const response = await POST(post({}, { origin: 'https://evil.test', 'sec-fetch-site': 'cross-site' }))
  expect(response.status).toBe(403)
  expect(response.headers.get('access-control-allow-origin')).toBeNull()
  expect(getShopSite).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})