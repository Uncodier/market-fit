/** @jest-environment node */

import { NextResponse } from 'next/server'
import { GET } from '@/app/api/images/prompt/route'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { readPromptImageCache } from '@/lib/images/prompt-image-cache'
import { generatePublicImage } from '@/lib/images/public-image-generation'

jest.mock('server-only', () => ({}))
jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))
jest.mock('@/lib/images/public-image-generation', () => ({ generatePublicImage: jest.fn() }))
jest.mock('@/lib/images/prompt-image-cache', () => ({
  ...jest.requireActual('@/lib/images/prompt-image-cache'), readPromptImageCache: jest.fn(),
}))

const siteId = '00000000-0000-4000-8000-000000000001'
const otherSite = '00000000-0000-4000-8000-000000000002'
const userId = '00000000-0000-4000-8000-000000000003'
const getSession = jest.fn()
const rpc = jest.fn()
const env = { ...process.env }
const bytes = new Uint8Array([137, 80, 78, 71])

function request(params: Record<string, string | undefined> = {}, headers: Record<string, string | undefined> = {}) {
  const entries = (values: Record<string, string | undefined>) => Object.entries(values).filter((entry): entry is [string, string] => entry[1] !== undefined)
  return new Request(`https://app.example.test/api/images/prompt?${new URLSearchParams({ prompt: 'Coffee', width: '400', height: '400', ...Object.fromEntries(entries(params)) })}`, {
    headers: { cookie: `mf_current_site_id=${siteId}; sb-test=session`, 'sec-fetch-site': 'same-origin', ...Object.fromEntries(entries(headers)) },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = 'https://api.example.test'
  delete process.env.NEXT_PUBLIC_API_SERVER_URL
  jest.mocked(readPromptImageCache).mockResolvedValue(null)
  jest.mocked(requireSiteAccess).mockResolvedValue({
    userId, userEmail: null, role: 'owner', supabase: { auth: { getSession }, rpc } as never,
  })
  rpc.mockResolvedValue({ data: true, error: null })
  getSession.mockResolvedValue({ data: { session: { access_token: 'verified-token', user: { id: userId } } }, error: null })
  jest.mocked(fetch).mockReset().mockResolvedValue(new Response(bytes, { headers: { 'content-type': 'image/png' } }))
})
afterAll(() => { process.env = env })

it('generates for the authorized site with only the verified user token, never Origin or service credentials', async () => {
  const response = await GET(request({}, { authorization: 'Bearer forged', 'x-api-key': 'forged-key', referer: 'https://app.example.test/catalog' }))
  expect(response.status).toBe(200)
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), siteId)
  expect(rpc).toHaveBeenCalledWith('user_can', { p_site_id: siteId, p_command: 'insert' })
  const [url, options] = jest.mocked(fetch).mock.calls[0]
  expect(String(url)).toBe(`https://api.example.test/api/public/image/prompt/Coffee?site_id=${siteId}&width=400&height=400`)
  expect(options).toMatchObject({ headers: { Authorization: 'Bearer verified-token', Accept: 'image/*' },
    credentials: 'omit', redirect: 'error', cache: 'no-store', signal: expect.any(AbortSignal) })
  expect(Object.keys(options?.headers || {})).toEqual(['Authorization', 'Accept'])
  expect(response.headers.get('cache-control')).toContain('private')
})

it('authorizes an explicit image site instead of trusting the current-site cookie', async () => {
  jest.mocked(requireSiteAccess).mockResolvedValueOnce({ error: NextResponse.json({}, { status: 403 }) })
  expect((await GET(request({ site_id: otherSite }))).status).toBe(403)
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.any(Request), otherSite)
  expect(fetch).not.toHaveBeenCalled()
})

it('serves existing public cached bytes without auth or generation', async () => {
  jest.mocked(readPromptImageCache).mockResolvedValueOnce({ bytes, contentType: 'image/webp' })
  const input = request({ site_id: siteId }, { cookie: '', 'sec-fetch-site': 'cross-site' })
  const response = await GET(input)
  expect(response.headers.get('content-type')).toBe('image/webp')
  expect(requireSiteAccess).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  [{}, { cookie: '' }],
  [{ site_id: siteId }, { cookie: '' }],
  [{ site_id: siteId, cache_only: '1' }, {}],
])('returns explicit neutral artwork for anonymous or cache-only misses without generating', async (params, headers) => {
  const response = await GET(request(params, headers))
  expect(response.status).toBe(200)
  expect(response.headers.get('x-image-delivery')).toBe('placeholder')
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(await response.text()).toContain('<svg')
  expect(requireSiteAccess).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it('does not generate for an anonymous shopper with unrelated cookies', async () => {
  jest.mocked(requireSiteAccess).mockResolvedValueOnce({ error: NextResponse.json({}, { status: 401 }) })
  const response = await GET(request({ site_id: siteId }, { cookie: 'cart=1' }))
  expect(response.headers.get('x-image-delivery')).toBe('placeholder')
  expect(fetch).not.toHaveBeenCalled()
})

it('generates public resource misses without using unrelated workspace credentials', async () => {
  jest.mocked(generatePublicImage).mockResolvedValueOnce({ bytes, contentType: 'image/png' })
  const params = { site_id: siteId, public: '1', resource_type: 'promotion', resource_id: otherSite }
  const response = await GET(request(params, { cookie: 'cart=1', 'sec-fetch-site': 'same-site', referer: 'https://www.makinari.com/' }))
  expect(response.status).toBe(200)
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
  expect(generatePublicImage).toHaveBeenCalledWith(expect.any(Request), expect.objectContaining(params))
  expect(requireSiteAccess).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it('preserves public generation denials and never falls through to workspace generation', async () => {
  jest.mocked(generatePublicImage).mockResolvedValueOnce(Response.json({ error: 'Public image resource not found' }, { status: 404 }))
  const response = await GET(request({ site_id: siteId, public: '1', resource_type: 'catalog', resource_id: otherSite }))
  expect(response.status).toBe(404)
  expect(requireSiteAccess).not.toHaveBeenCalled()
})

it.each([
  { public: '1' },
  { public: '1', site_id: siteId },
  { public: '1', site_id: siteId, resource_type: 'catalog', resource_id: otherSite, cache_only: '1' },
])('never authorizes paid public generation without a complete resource or for explicit cache-only: %j', async params => {
  const response = await GET(request(params))
  expect(response.headers.get('x-image-delivery')).toBe('placeholder')
  expect(generatePublicImage).not.toHaveBeenCalled()
  expect(requireSiteAccess).not.toHaveBeenCalled()
})

it.each([
  { 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'same-site' },
  { origin: 'https://evil.test' }, { 'sec-fetch-site': 'none' },
])('blocks cross-origin paid generation even with cookies: %j', async headers => {
  expect((await GET(request({}, headers))).status).toBe(403)
  expect(requireSiteAccess).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it('denies read-only capability and invalid sessions', async () => {
  rpc.mockResolvedValueOnce({ data: false, error: null })
  expect((await GET(request())).status).toBe(403)
  for (const session of [null, { access_token: 'token', user: { id: 'other-user' } }]) {
    getSession.mockResolvedValueOnce({ data: { session }, error: null })
    expect((await GET(request())).status).toBe(401)
  }
  expect(fetch).not.toHaveBeenCalled()
})

it('rejects malformed inputs before accessing the cache or auth', async () => {
  for (const params of [{ prompt: '' }, { prompt: '..' }, { prompt: '\n' }, { prompt: 'x'.repeat(2001) },
    { width: '2000' }, { height: '-1' }, { site_id: 'demo-site' }, { target: 'https://evil.test' },
    { signature: 'untrusted' }, { public: '0' }, { host_id: 'untrusted' },
    { resource_type: 'private' }, { resource_id: 'untrusted' }]) {
    expect((await GET(request(params))).status).toBe(400)
  }
  expect(readPromptImageCache).not.toHaveBeenCalled()
  expect(requireSiteAccess).not.toHaveBeenCalled()
})

it.each([401, 403, 409, 429, 503])('preserves API rejection %i without raw details or replay', async status => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ error: 'private provider detail' }, { status }))
  const response = await GET(request())
  expect(response.status).toBe(status)
  expect(await response.text()).not.toContain('private provider detail')
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('does not treat HTML, SVG, oversized data or a network failure as successful generation', async () => {
  for (const response of [new Response('html'), new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }),
    new Response(bytes, { headers: { 'content-type': 'image/png', 'content-length': String(9 * 1024 * 1024) } })]) {
    jest.mocked(fetch).mockResolvedValueOnce(response)
    expect((await GET(request())).status).toBe(502)
  }
  jest.mocked(fetch).mockRejectedValueOnce(new Error('private error'))
  expect((await GET(request())).status).toBe(502)
  expect(fetch).toHaveBeenCalledTimes(4)
})

it('fails closed on a missing or unsafe API configuration', async () => {
  for (const url of ['', 'https://app.example.test', 'https://user:secret@api.example.test', 'http://api.example.test']) {
    process.env.API_SERVER_URL = url
    expect((await GET(request())).status).toBe(503)
  }
  expect(fetch).not.toHaveBeenCalled()
})