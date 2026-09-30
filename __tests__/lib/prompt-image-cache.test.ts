/** @jest-environment node */

import { createHash } from 'node:crypto'
import { promptImageCacheUrl, readPromptImageCache } from '@/lib/images/prompt-image-cache'
import { parsePromptImageInput } from '@/lib/images/prompt-image-contract'

jest.mock('server-only', () => ({}))
const siteId = '00000000-0000-4000-8000-000000000001'
const input = { prompt: ' Coffee ', width: 400, height: 400 }
const originalStorage = process.env.NEXT_PUBLIC_SUPABASE_URL

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
  jest.mocked(fetch).mockReset()
})
afterAll(() => {
  if (originalStorage === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalStorage
})

it('matches the actual API cache hash and scopes it by site and dimensions', () => {
  const expected = createHash('sha256').update(`v2:${siteId}: coffee|400x400`).digest('hex')
  expect(String(promptImageCacheUrl(input, siteId))).toBe(`https://project.supabase.co/storage/v1/object/public/generative_images/prompt_cache/${expected}`)
  expect(String(promptImageCacheUrl(input, siteId))).not.toBe(String(promptImageCacheUrl({ ...input, width: 128 }, siteId)))
  expect(String(promptImageCacheUrl(input, siteId))).not.toBe(String(promptImageCacheUrl(input, '00000000-0000-4000-8000-000000000002')))
})

it('reads only public storage without credentials, redirects or generation requests', async () => {
  const bytes = new Uint8Array([1, 2, 3])
  jest.mocked(fetch).mockResolvedValueOnce(new Response(bytes, { headers: { 'content-type': 'image/png' } }))
  expect(await readPromptImageCache(input, siteId)).toEqual({ bytes, contentType: 'image/png' })
  const [url, options] = jest.mocked(fetch).mock.calls[0]
  expect(String(url)).toContain('/storage/v1/object/public/generative_images/prompt_cache/')
  expect(options).toMatchObject({ headers: { Accept: 'image/*' }, credentials: 'omit', redirect: 'error', signal: expect.any(AbortSignal) })
})

it('returns no cache for misses, unsafe MIME types or unavailable storage without replay', async () => {
  for (const response of [new Response(null, { status: 404 }), new Response('html', { headers: { 'content-type': 'text/html' } }),
    new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } })]) {
    jest.mocked(fetch).mockResolvedValueOnce(response)
    expect(await readPromptImageCache(input, siteId)).toBeNull()
  }
  jest.mocked(fetch).mockRejectedValueOnce(new Error('offline'))
  expect(await readPromptImageCache(input, siteId)).toBeNull()
  expect(fetch).toHaveBeenCalledTimes(4)
})

it('does not fetch unconfigured or unsafe origins or unscoped cache entries', async () => {
  for (const base of ['', 'http://project.supabase.co', 'https://user:pass@project.supabase.co', 'https://evil.test',
    'https://project.supabase.co/path', 'https://project.supabase.co?url=x']) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = base
    expect(await readPromptImageCache(input, siteId)).toBeNull()
  }
  expect(await readPromptImageCache(input)).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
})

it('rejects duplicates and unsafe paths while preserving reserved characters in real prompts', () => {
  expect(parsePromptImageInput(new URLSearchParams('prompt=a&prompt=b'))).toBeNull()
  expect(parsePromptImageInput(new URLSearchParams('prompt=..'))).toBeNull()
  expect(parsePromptImageInput(new URLSearchParams({ prompt: 'Coffee / tea? 50% #1 & more', width: '512' })))
    .toMatchObject({ prompt: 'Coffee / tea? 50% #1 & more', width: 512, height: 1024 })
})