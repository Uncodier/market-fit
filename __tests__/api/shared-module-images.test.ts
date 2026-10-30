/** @jest-environment node */

import { GET } from '@/app/api/images/modules/[itemKey]/route'
import { getModuleImagePrompt } from '@/app/config/module-image-visuals'
import { SUPPORT_SITE_ID } from '@/lib/chat/identity-types'
import { readPromptImageCache } from '@/lib/images/prompt-image-cache'
import { checkRateLimit } from '@/lib/redis/control-plane'
import { createClient } from '@/lib/supabase/server'

jest.mock('server-only', () => ({}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/images/prompt-image-cache', () => ({
  ...jest.requireActual('@/lib/images/prompt-image-cache'), readPromptImageCache: jest.fn(),
}))
jest.mock('@/lib/redis/control-plane', () => ({
  checkRateLimit: jest.fn(),
  rateLimitError: jest.fn(() => Response.json({ error: 'Rate limited' }, { status: 429 })),
}))

const bytes = new Uint8Array([137, 80, 78, 71])
const getUser = jest.fn()
const originalEnv = { ...process.env }

function request(headers: Record<string, string> = {}, query = '') {
  return new Request(`https://app.example.test/api/images/modules/suppliers${query}`, {
    headers: { 'sec-fetch-site': 'same-origin', cookie: 'mf_current_site_id=other-site', ...headers },
  })
}

function run(req = request(), itemKey = 'suppliers') {
  return GET(req, { params: Promise.resolve({ itemKey }) })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = 'https://api.example.test'
  process.env.SERVICE_API_KEY = 'server-test-key'
  jest.mocked(readPromptImageCache).mockResolvedValue(null)
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser } } as never)
  getUser.mockResolvedValue({ data: { user: { id: 'verified-user' } }, error: null })
  jest.mocked(checkRateLimit).mockResolvedValue({ allowed: true } as never)
  jest.mocked(fetch).mockReset().mockResolvedValue(new Response(bytes, { headers: { 'Content-Type': 'image/png' } }))
})

afterAll(() => { process.env = originalEnv })

it('serves the public Makinari cache without authenticating or generating', async () => {
  jest.mocked(readPromptImageCache).mockResolvedValue({ bytes, contentType: 'image/png' })
  const response = await run(request({ 'sec-fetch-site': 'cross-site' }))
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toContain('public')
  expect(response.headers.get('x-image-delivery')).toBe('makinari-cache')
  expect(readPromptImageCache).toHaveBeenCalledWith({
    prompt: getModuleImagePrompt('buying', 'suppliers', ''), width: 256, height: 256,
  }, SUPPORT_SITE_ID)
  expect(createClient).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it('generates only the fixed prompt under Makinari with server credentials', async () => {
  const response = await run(request({ authorization: 'Bearer forged', 'x-api-key': 'forged',
    referer: 'https://app.example.test/navigation' }))
  expect(response.status).toBe(200)
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('x-image-delivery')).toBe('makinari-generated')
  expect(createClient).toHaveBeenCalledWith(true)
  const [target, options] = jest.mocked(fetch).mock.calls[0]
  const url = new URL(String(target))
  expect(url.origin).toBe('https://api.example.test')
  expect(decodeURIComponent(url.pathname)).toBe(`/api/public/image/prompt/${getModuleImagePrompt('buying', 'suppliers', '')}`)
  expect(Object.fromEntries(url.searchParams)).toEqual({ site_id: SUPPORT_SITE_ID, width: '256', height: '256' })
  expect(options).toMatchObject({ headers: { 'x-api-key': 'server-test-key', Accept: 'image/*' },
    credentials: 'omit', cache: 'no-store', redirect: 'error', signal: expect.any(AbortSignal) })
  expect(Object.keys(options?.headers || {})).toEqual(['x-api-key', 'Accept'])
  expect(checkRateLimit).toHaveBeenCalledWith('rl:v1:shared-module-images:user:verified-user',
    { limit: 30, windowSeconds: 60, failureMode: 'closed' })
  expect(checkRateLimit).toHaveBeenCalledWith('rl:v1:shared-module-images:generation',
    { limit: 20, windowSeconds: 3600, failureMode: 'closed' })
})

it.each(['?site_id=other', '?prompt=arbitrary', '?width=1024', '?target=https://evil.test', '?signature=forged'])(
  'rejects client overrides %s before cache or auth', async query => {
    expect((await run(request({}, query))).status).toBe(400)
    expect(readPromptImageCache).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  },
)

it.each(['billing', 'toString', '__proto__', 'unknown'])(
  'rejects non-allowlisted module %s', async key => {
    expect((await run(request(), key)).status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  },
)

it.each<Record<string, string>>([{ 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'same-site' },
  { 'sec-fetch-site': 'none' }, { origin: 'https://evil.test' }])(
  'rejects foreign generation requests %j', async headers => {
    expect((await run(request(headers))).status).toBe(403)
    expect(createClient).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  },
)

it('rejects unauthenticated misses including demo cookies', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null })
  const response = await run(request({ cookie: 'market_fit_demo_site_id=demo-site' }))
  expect(response.status).toBe(401)
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(fetch).not.toHaveBeenCalled()
})

it('fails closed without server credentials or API configuration', async () => {
  delete process.env.SERVICE_API_KEY
  expect((await run()).status).toBe(503)
  process.env.SERVICE_API_KEY = 'server-test-key'
  process.env.API_SERVER_URL = 'https://user:password@evil.test'
  expect((await run()).status).toBe(503)
  expect(fetch).not.toHaveBeenCalled()
})

it('blocks exhausted user and generation budgets', async () => {
  jest.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false } as never)
  expect((await run()).status).toBe(429)
  jest.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: true } as never)
    .mockResolvedValueOnce({ allowed: false } as never)
  expect((await run()).status).toBe(429)
  expect(fetch).not.toHaveBeenCalled()
})

it.each([401, 402, 403, 409, 429, 503, 500])('preserves upstream failure %s without replay', async status => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ error: 'upstream' }, { status }))
  expect((await run()).status).toBe(status === 500 ? 502 : status)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('rejects non-raster responses and does not replay network failures', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }))
  expect((await run()).status).toBe(502)
  jest.mocked(fetch).mockRejectedValueOnce(new Error('Timeout'))
  expect((await run()).status).toBe(502)
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('coalesces concurrent authorized generation for the same module', async () => {
  let resolveFetch!: (response: Response) => void
  jest.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { resolveFetch = resolve }))
  const first = run()
  const second = run()
  for (let i = 0; i < 20 && !resolveFetch; i++) await Promise.resolve()
  expect(fetch).toHaveBeenCalledTimes(1)
  resolveFetch(new Response(bytes, { headers: { 'Content-Type': 'image/png' } }))
  const responses = await Promise.all([first, second])
  expect(responses.map(response => response.status)).toEqual([200, 200])
  for (const response of responses) expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
})