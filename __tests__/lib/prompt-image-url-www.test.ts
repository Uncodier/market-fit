/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://www.makinari.com/shop/example"}
 */

import { normalizePromptImageUrl, isPromptImageUrl } from '@/app/lib/prompt-image-url'
import { publicPromptImageUrl, resolveItemImage } from '@/app/lib/image-utils'

const siteId = '00000000-0000-4000-8000-000000000001'

it('delivers www prompt images from app with public-resource generation semantics', () => {
  const result = publicPromptImageUrl(' Coffee / tea? #1 & 50% ', 400, siteId)
  const url = new URL(result)
  expect(url.origin).toBe('https://app.makinari.com')
  expect(url.pathname).toBe('/api/images/prompt')
  expect(Object.fromEntries(url.searchParams)).toEqual({
    prompt: 'Coffee / tea? #1 & 50%', width: '400', height: '400', site_id: siteId, public: '1',
  })
  expect(isPromptImageUrl(result)).toBe(true)
  expect(resolveItemImage({ name: 'Coffee', site_id: siteId }, 'card')).toBe(publicPromptImageUrl('Coffee', 400, siteId))
})

it.each([
  '/api/images/prompt?prompt=Coffee%20%26%20Tea&width=512&height=256',
  'https://old-api.test/api/public/image/prompt/Coffee%20%26%20Tea?width=512&height=256',
])('normalizes %s to app without copying credentials, origins or unsafe query overrides', value => {
  const result = normalizePromptImageUrl(`${value}&site_id=forged&signature=private&user_id=forged&cache_only=0&target=https://evil.test&token=private`, siteId)
  expect(result).toBe(`https://app.makinari.com/api/images/prompt?prompt=Coffee+%26+Tea&width=512&height=256&site_id=${siteId}&public=1`)
  expect(normalizePromptImageUrl(result, siteId)).toBe(result)
})

it('does not reroute uploaded media', () => {
  expect(normalizePromptImageUrl('https://cdn.example.test/image.png')).toBe('https://cdn.example.test/image.png')
})