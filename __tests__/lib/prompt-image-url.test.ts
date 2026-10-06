import { normalizePromptImageUrl } from '@/app/lib/prompt-image-url'
import { publicPromptImageUrl, resolveItemImage, resolvePromotionImage } from '@/app/lib/image-utils'
import { resolveCatalogItemShareImageSource, resolveShopShareVisual } from '@/app/lib/commerce-metadata'

const siteId = '00000000-0000-4000-8000-000000000001'

it('builds a same-origin URL with encoded text and an explicit tenant, without any token', () => {
  const result = publicPromptImageUrl('Coffee / tea? #1 & 50%', 400, siteId)
  const url = new URL(result, 'https://app.example.test')
  expect(result.startsWith('/api/images/prompt?')).toBe(true)
  expect(url.searchParams.get('prompt')).toBe('Coffee / tea? #1 & 50%')
  expect(url.searchParams.get('site_id')).toBe(siteId)
  expect([...url.searchParams.keys()]).toEqual(['prompt', 'width', 'height', 'site_id'])
})

it('preserves item/site context for public cache delivery', () => {
  expect(resolveItemImage({ name: 'Coffee', site_id: siteId })).toContain(`site_id=${siteId}`)
  expect(resolveItemImage({ name: 'Coffee', site: { id: siteId } })).toContain(`site_id=${siteId}`)
  expect(resolvePromotionImage({ name: 'Deal', site_id: siteId })).toContain(`site_id=${siteId}`)
  const share = resolveCatalogItemShareImageSource({ name: 'Coffee', site_id: siteId })
  expect(share).toMatchObject({ kind: 'url', url: expect.stringContaining(`site_id=${siteId}`) })
  expect(resolveShopShareVisual({ id: siteId, name: 'Shop' }).source)
    .toMatchObject({ kind: 'url', url: expect.stringContaining(`site_id=${siteId}`) })
})

it('replaces legacy generated URLs, including persisted ones, without forwarding their origin or credentials', () => {
  const legacy = 'https://old-api.test/api/public/image/prompt/Coffee%20%26%20Tea?width=512&height=512&signature=private&user_id=forged'
  const result = normalizePromptImageUrl(legacy, siteId)
  expect(result).toBe(publicPromptImageUrl('Coffee & Tea', 512, siteId))
  expect(resolveItemImage({ name: 'Coffee', image_url: legacy, site_id: siteId })).toBe(result)
  expect(resolvePromotionImage({ name: 'Deal', image_url: legacy, site_id: siteId })).toBe(result)
  expect(resolveCatalogItemShareImageSource({ name: 'Coffee', image_url: legacy, site_id: siteId }))
    .toEqual({ kind: 'url', url: result })
  expect(resolveShopShareVisual({ id: siteId, name: 'Shop', logo_url: legacy }).source)
    .toEqual({ kind: 'url', url: result })
})

it('leaves ordinary uploaded images alone', () => {
  expect(normalizePromptImageUrl('https://cdn.example.test/image.png')).toBe('https://cdn.example.test/image.png')
})

it('keeps local/workspace normalization relative and never adds public-cache-only generation restrictions', () => {
  expect(normalizePromptImageUrl('https://old-api.test/api/images/prompt?prompt=Coffee&width=400&height=256&signature=private&cache_only=0', siteId))
    .toBe(`/api/images/prompt?prompt=Coffee&width=400&height=256&site_id=${siteId}`)
})