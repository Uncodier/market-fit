/** @jest-environment node */

import { generatePublicImage } from '@/lib/images/public-image-generation'
import { resolvePublicImageResource } from '@/lib/images/public-image-resource'
import { MAX_IMAGE_BYTES, readPromptImageCache, type ImageBytes } from '@/lib/images/prompt-image-cache'
import { checkRateLimit, hashRedisKeyPart, rateLimitError, type RateLimitResult } from '@/lib/redis/control-plane'
import type { PromptImageInput } from '@/lib/images/prompt-image-contract'

jest.mock('server-only', () => ({}))
jest.mock('@/lib/images/public-image-resource', () => ({ resolvePublicImageResource: jest.fn() }))
jest.mock('@/lib/redis/control-plane', () => ({ checkRateLimit: jest.fn(), hashRedisKeyPart: jest.fn(), rateLimitError: jest.fn() }))
jest.mock('@/lib/images/prompt-image-cache', () => ({
  ...jest.requireActual('@/lib/images/prompt-image-cache'), readPromptImageCache: jest.fn(),
}))

const siteId = '00000000-0000-4000-8000-000000000001'
const otherSite = '00000000-0000-4000-8000-000000000002'
const resourceId = '00000000-0000-4000-8000-000000000003'
const input: PromptImageInput = { prompt: 'Untrusted client prompt', site_id: siteId, width: 128, height: 600,
  public: '1', resource_type: 'catalog', resource_id: resourceId }
const canonical: PromptImageInput = { prompt: 'Database mug / tea? 50% #1 & more', site_id: siteId, width: 1024, height: 1024 }
const image: ImageBytes = { bytes: new Uint8Array([137, 80, 78, 71]), contentType: 'image/png' }
const allowed: RateLimitResult = { allowed: true, limit: 300, remaining: 299, resetMs: 60_000 }
const denied: RateLimitResult = { ...allowed, allowed: false, remaining: 0 }
const originalEnv = { SERVICE_API_KEY: process.env.SERVICE_API_KEY, API_SERVER_URL: process.env.API_SERVER_URL,
  NEXT_PUBLIC_API_SERVER_URL: process.env.NEXT_PUBLIC_API_SERVER_URL }

function providerImage() {
  return new Response(new Uint8Array(image.bytes), { headers: { 'content-type': image.contentType } })
}

function request(headers: Record<string, string | undefined> = {}, origin = 'https://app.makinari.com') {
  const defaults = { referer: `${origin}/shop/artisan`, 'sec-fetch-site': 'same-origin', 'x-real-ip': '192.0.2.10', ...headers }
  return new Request(`${origin}/api/images/prompt?prompt=attacker-controlled&site_id=${otherSite}`, {
    headers: Object.fromEntries(Object.entries(defaults).filter((entry): entry is [string, string] => entry[1] !== undefined)),
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(finish => { resolve = finish })
  return { promise, resolve }
}

async function failure(result: ImageBytes | Response, status: number) {
  expect(result).toBeInstanceOf(Response)
  const response = result as Response
  expect(response.status).toBe(status)
  return response
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.SERVICE_API_KEY = '  trusted-service-test-key  '
  process.env.API_SERVER_URL = 'https://api.example.test'
  delete process.env.NEXT_PUBLIC_API_SERVER_URL
  jest.mocked(checkRateLimit).mockReset().mockResolvedValue(allowed)
  jest.mocked(hashRedisKeyPart).mockReset().mockResolvedValue('hashed-client')
  jest.mocked(rateLimitError).mockReset().mockImplementation(result => Response.json(
    { error: result.unavailable ? 'Request admission is temporarily unavailable' : 'Too many requests' },
    { status: result.unavailable ? 503 : 429, headers: { 'Retry-After': '60' } },
  ) as never)
  jest.mocked(resolvePublicImageResource).mockReset().mockResolvedValue(canonical)
  jest.mocked(readPromptImageCache).mockReset().mockResolvedValue(null)
  jest.mocked(fetch).mockReset().mockImplementation(async () => providerImage())
})

afterAll(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

it.each(['/shop', '/shop/artisan/item', '/marketplace', '/book/artisan', '/cart/checkout'])
  ('accepts same-origin commerce page %s', async pathname => {
    expect(await generatePublicImage(request({ referer: `https://app.makinari.com${pathname}` }), input)).toEqual(image)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

it.each(['https://www.makinari.com', 'https://makinari.com'])
  ('accepts the native origin-only Referer from trusted commerce platform %s to app', async origin => {
    expect(await generatePublicImage(request({ referer: `${origin}/`, 'sec-fetch-site': 'same-site' }), input)).toEqual(image)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

it('accepts a trusted commerce platform pair with a full page Referer and matching Origin', async () => {
  expect(await generatePublicImage(request({ referer: 'https://www.makinari.com/marketplace',
    origin: 'https://www.makinari.com', 'sec-fetch-site': 'same-site' }), input)).toEqual(image)
})

it('supports a same-origin local commerce page without a platform hostname exemption', async () => {
  expect(await generatePublicImage(request({}, 'http://localhost:3000'), input)).toEqual(image)
})

it.each([
  { referer: undefined }, { referer: 'not a URL' }, { referer: '/shop/artisan' },
  { referer: 'https://evil.example.test/shop/artisan' }, { referer: 'https://evil.example.test/' },
  { referer: 'https://www.makinari.com.evil.example.test/' }, { referer: 'http://www.makinari.com/' },
  { referer: 'https://app.makinari.com/' }, { referer: 'https://app.makinari.com/catalog' },
  { referer: 'https://app.makinari.com/shopper' }, { referer: 'https://app.makinari.com/marketplaces' },
  { origin: 'https://evil.example.test' }, { origin: 'null' },
  { referer: 'https://www.makinari.com/shop/artisan', origin: 'https://app.makinari.com' },
  { 'sec-fetch-site': 'cross-site' },
])('rejects malformed, noncommerce or cross-site browser context before any admission/write: %j', async headers => {
  const response = await failure(await generatePublicImage(request(headers), input), 403)
  expect(response.headers.get('cache-control')).toBe('no-store, private')
  expect(checkRateLimit).not.toHaveBeenCalled()
  expect(hashRedisKeyPart).not.toHaveBeenCalled()
  expect(resolvePublicImageResource).not.toHaveBeenCalled()
  expect(readPromptImageCache).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it('does not extend platform trust to an unrelated image endpoint origin', async () => {
  await failure(await generatePublicImage(request({ referer: 'https://www.makinari.com/shop/artisan' }, 'https://preview.example.test'), input), 403)
  expect(checkRateLimit).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it.each([false, true])('fails closed at client admission before resource access (Redis unavailable: %s)', async unavailable => {
  const rejection = { ...denied, unavailable }
  jest.mocked(checkRateLimit).mockResolvedValueOnce(rejection)
  await failure(await generatePublicImage(request(), input), unavailable ? 503 : 429)
  expect(checkRateLimit).toHaveBeenCalledWith('rl:v1:public-image:client:hashed-client',
    { limit: 300, windowSeconds: 60, failureMode: 'closed' })
  expect(rateLimitError).toHaveBeenCalledWith(rejection)
  expect(resolvePublicImageResource).not.toHaveBeenCalled()
  expect(readPromptImageCache).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  [{ 'x-vercel-forwarded-for': ' 192.0.2.20, 192.0.2.30', 'x-real-ip': '192.0.2.40' }, '192.0.2.20'],
  [{ 'x-real-ip': ' 192.0.2.40 ' }, '192.0.2.40'],
  [{ 'x-real-ip': undefined }, 'unknown'],
])('hashes only the selected client address rather than embedding raw IP in Redis keys', async (headers, ip) => {
  jest.mocked(readPromptImageCache).mockResolvedValueOnce(image)
  expect(await generatePublicImage(request(headers), input)).toEqual(image)
  expect(hashRedisKeyPart).toHaveBeenCalledWith(ip)
  expect(checkRateLimit).toHaveBeenCalledTimes(1)
  expect(checkRateLimit).toHaveBeenCalledWith('rl:v1:public-image:client:hashed-client', expect.any(Object))
})

it.each([null, { ...canonical, site_id: undefined }])('does not read cache or spend credits for an unresolved resource: %j', async resource => {
  jest.mocked(resolvePublicImageResource).mockResolvedValueOnce(resource)
  await failure(await generatePublicImage(request(), input), 404)
  expect(resolvePublicImageResource).toHaveBeenCalledWith(input)
  expect(checkRateLimit).toHaveBeenCalledTimes(1)
  expect(readPromptImageCache).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it('keeps the upstream and cache blocked while resource authorization is unresolved', async () => {
  const resource = deferred<PromptImageInput | null>()
  jest.mocked(resolvePublicImageResource).mockReturnValueOnce(resource.promise)
  const pending = generatePublicImage(request(), input)
  await new Promise<void>(resolve => setImmediate(resolve))
  expect(resolvePublicImageResource).toHaveBeenCalledWith(input)
  expect(checkRateLimit).toHaveBeenCalledTimes(1)
  expect(readPromptImageCache).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
  resource.resolve(canonical)
  expect(await pending).toEqual(image)
})

it('returns a validated canonical cache hit without service configuration or generation budgets', async () => {
  delete process.env.SERVICE_API_KEY
  delete process.env.API_SERVER_URL
  jest.mocked(readPromptImageCache).mockResolvedValueOnce(image)
  expect(await generatePublicImage(request(), input)).toBe(image)
  expect(readPromptImageCache).toHaveBeenCalledWith(canonical, siteId)
  expect(jest.mocked(resolvePublicImageResource).mock.invocationCallOrder[0])
    .toBeLessThan(jest.mocked(readPromptImageCache).mock.invocationCallOrder[0])
  expect(checkRateLimit).toHaveBeenCalledTimes(1)
  expect(fetch).not.toHaveBeenCalled()
})

it('generates only a validated database prompt with canonical dimensions and isolated service headers', async () => {
  const result = await generatePublicImage(request({ authorization: 'Bearer browser-secret', cookie: 'sb-session=browser-secret',
    origin: 'https://app.makinari.com', 'x-api-key': 'forged-key', 'x-site-id': otherSite }), input)
  expect(result).toEqual(image)
  expect(fetch).toHaveBeenCalledTimes(1)
  const [target, options] = jest.mocked(fetch).mock.calls[0]
  const url = new URL(String(target))
  expect(url.origin).toBe('https://api.example.test')
  expect(url.pathname).toBe(`/api/public/image/prompt/${encodeURIComponent(canonical.prompt)}`)
  expect(Object.fromEntries(url.searchParams)).toEqual({ site_id: siteId, width: '1024', height: '1024' })
  expect(String(target)).not.toContain('Untrusted')
  expect(String(target)).not.toContain(otherSite)
  expect(options).toMatchObject({ headers: { 'x-api-key': 'trusted-service-test-key', Accept: 'image/*' },
    credentials: 'omit', cache: 'no-store', redirect: 'error', signal: expect.any(AbortSignal) })
  expect(Object.keys(options?.headers || {}).sort()).toEqual(['Accept', 'x-api-key'])
  expect(jest.mocked(resolvePublicImageResource).mock.invocationCallOrder[0])
    .toBeLessThan(jest.mocked(fetch).mock.invocationCallOrder[0])
  expect(jest.mocked(readPromptImageCache).mock.invocationCallOrder[0])
    .toBeLessThan(jest.mocked(fetch).mock.invocationCallOrder[0])
  expect(jest.mocked(checkRateLimit).mock.invocationCallOrder[0])
    .toBeLessThan(jest.mocked(resolvePublicImageResource).mock.invocationCallOrder[0])
  expect(jest.mocked(readPromptImageCache).mock.invocationCallOrder[0])
    .toBeLessThan(jest.mocked(checkRateLimit).mock.invocationCallOrder[1])
  expect(jest.mocked(checkRateLimit).mock.invocationCallOrder[2])
    .toBeLessThan(jest.mocked(fetch).mock.invocationCallOrder[0])
  expect(checkRateLimit).toHaveBeenNthCalledWith(2, `rl:v1:public-image:generation:site:${siteId}`,
    { limit: 60, windowSeconds: 3600, failureMode: 'closed' })
  expect(checkRateLimit).toHaveBeenNthCalledWith(3, 'rl:v1:public-image:generation:global',
    { limit: 200, windowSeconds: 3600, failureMode: 'closed' })
})

it.each(['', '   '])('fails closed on an unconfigured service key %j without generation budgets or upstream writes', async key => {
  process.env.SERVICE_API_KEY = key
  await failure(await generatePublicImage(request(), input), 503)
  expect(readPromptImageCache).toHaveBeenCalledWith(canonical, siteId)
  expect(checkRateLimit).toHaveBeenCalledTimes(1)
  expect(fetch).not.toHaveBeenCalled()
})

it.each(['', 'https://app.makinari.com', 'https://user:secret@api.example.test', 'http://api.example.test',
  'https://api.example.test/path', 'https://api.example.test?override=1'])
  ('fails closed on unsafe/unconfigured upstream %j', async url => {
    process.env.API_SERVER_URL = url
    const response = await failure(await generatePublicImage(request(), input), 503)
    expect(await response.text()).not.toContain('secret')
    expect(checkRateLimit).toHaveBeenCalledTimes(1)
    expect(fetch).not.toHaveBeenCalled()
  })

it.each([
  ['site', 2, false], ['site', 2, true], ['global', 3, false], ['global', 3, true],
] as const)('denies %s generation admission without upstream replay (unavailable: %s)', async (_scope, count, unavailable) => {
  const rejection = { ...denied, unavailable }
  for (let index = 1; index < count; index++) jest.mocked(checkRateLimit).mockResolvedValueOnce(allowed)
  jest.mocked(checkRateLimit).mockResolvedValueOnce(rejection)
  await failure(await generatePublicImage(request(), input), unavailable ? 503 : 429)
  expect(checkRateLimit).toHaveBeenCalledTimes(count)
  expect(rateLimitError).toHaveBeenCalledWith(rejection)
  expect(fetch).not.toHaveBeenCalled()
})

it.each([400, 401, 402, 403, 409, 429, 503, 500])('sanitizes provider rejection %i and never retries uncertain work', async status => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ error: 'PRIVATE PROVIDER DETAIL' }, { status }))
  const response = await failure(await generatePublicImage(request(), input), status === 500 ? 502 : status)
  expect(response.headers.get('cache-control')).toBe('no-store, private')
  expect(await response.text()).not.toContain('PRIVATE PROVIDER DETAIL')
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(checkRateLimit).toHaveBeenCalledTimes(3)
})

it.each(['text/html', 'image/svg+xml', 'application/json', 'image/png;empty', 'image/png;oversized'])
  ('rejects unsafe or unusable provider body %s without retry', async kind => {
    const contentType = kind.split(';')[0]
    const body = kind.endsWith(';empty') ? null : 'PRIVATE PROVIDER BODY'
    const headers: Record<string, string> = { 'content-type': contentType }
    if (kind.endsWith(';oversized')) headers['content-length'] = String(MAX_IMAGE_BYTES + 1)
    jest.mocked(fetch).mockResolvedValueOnce(new Response(body, { headers }))
    const response = await failure(await generatePublicImage(request(), input), 502)
    expect(await response.text()).not.toContain('PRIVATE PROVIDER BODY')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

it('coalesces concurrent canonical misses across client prompts and sizes, then clears completed work', async () => {
  const upstream = deferred<Response>()
  jest.mocked(fetch).mockReturnValueOnce(upstream.promise)
  const first = generatePublicImage(request(), input)
  const second = generatePublicImage(request(), { ...input, prompt: 'Different browser prompt', width: 1024, height: 1024 })
  await new Promise<void>(resolve => setImmediate(resolve))
  expect(resolvePublicImageResource).toHaveBeenCalledTimes(2)
  expect(readPromptImageCache).toHaveBeenCalledTimes(2)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(jest.mocked(checkRateLimit).mock.calls.filter(([key]) => key.includes(':generation:'))).toHaveLength(2)
  upstream.resolve(providerImage())
  expect(await Promise.all([first, second])).toEqual([image, image])
  expect(await generatePublicImage(request(), input)).toEqual(image)
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('returns independently readable failures to coalesced callers and allows only an explicit later retry', async () => {
  const upstream = deferred<Response>()
  jest.mocked(fetch).mockReturnValueOnce(upstream.promise)
  const pending = [generatePublicImage(request(), input), generatePublicImage(request(), input)]
  await new Promise<void>(resolve => setImmediate(resolve))
  upstream.resolve(new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }))
  const results = await Promise.all(pending)
  const first = await failure(results[0], 502)
  const second = await failure(results[1], 502)
  expect(first).not.toBe(second)
  expect(await first.json()).toEqual(await second.json())
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(await generatePublicImage(request(), input)).toEqual(image)
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('never coalesces identical prompts from different authorized sites', async () => {
  const upstream = deferred<Response>()
  jest.mocked(resolvePublicImageResource).mockResolvedValueOnce(canonical).mockResolvedValueOnce({ ...canonical, site_id: otherSite })
  jest.mocked(fetch).mockImplementation(async () => { await upstream.promise; return providerImage() })
  const pending = [generatePublicImage(request(), input), generatePublicImage(request(), { ...input, site_id: otherSite })]
  await new Promise<void>(resolve => setImmediate(resolve))
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(jest.mocked(fetch).mock.calls.map(([url]) => new URL(String(url)).searchParams.get('site_id'))).toEqual([siteId, otherSite])
  upstream.resolve(new Response(null))
  expect(await Promise.all(pending)).toEqual([image, image])
})

it('does not replay a thrown upstream failure and clears rejected inFlight work for an explicit later call', async () => {
  jest.mocked(fetch).mockRejectedValueOnce(new Error('uncertain upstream transport'))
  // The enclosing route owns transport-error sanitization; the bridge must not replay paid work.
  await expect(generatePublicImage(request(), input)).rejects.toThrow('uncertain upstream transport')
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(await generatePublicImage(request(), input)).toEqual(image)
  expect(fetch).toHaveBeenCalledTimes(2)
})