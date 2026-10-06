/** @jest-environment node */

import { publicImageDeliveryFromHeaders } from '@/app/lib/public-image-delivery'
import { promptImageUrl, normalizePromptImageUrl } from '@/app/lib/prompt-image-url'
import { resolveItemImage, resolvePromotionImage, buildPdpGalleryEntries } from '@/app/lib/image-utils'

const headerReader = (values: Record<string, string>) => ({ get: (name: string) => values[name] || null })
const siteId = '00000000-0000-4000-8000-000000000001'

it.each(['www.makinari.com', 'makinari.com', 'app.makinari.com', 'WWW.MAKINARI.COM:443'])(
  'resolves public SSR delivery on the exact official host %s', host => {
    const delivery = publicImageDeliveryFromHeaders(headerReader({ host }))
    expect(promptImageUrl('Coffee', 400, siteId, delivery))
      .toBe(`https://app.makinari.com/api/images/prompt?prompt=Coffee&width=400&height=400&site_id=${siteId}&cache_only=1`)
  },
)

it.each(['localhost:3000', '127.0.0.1:3000', 'demo.makinari.com', 'branch.preview.makinari.com',
  'branch.vercel.app', 'shop.example.test', 'www.makinari.com.evil.test', 'www.makinari.com:3000',
  'user@www.makinari.com', 'https://www.makinari.com', ''])(
  'keeps public %s relative and cache-only without changing workspace generation', host => {
    const delivery = publicImageDeliveryFromHeaders(headerReader({ host }))
    expect(promptImageUrl('Coffee', 400, siteId, delivery))
      .toBe(`/api/images/prompt?prompt=Coffee&width=400&height=400&site_id=${siteId}&cache_only=1`)
    expect(resolveItemImage({ name: 'Coffee', site_id: siteId }, 'card'))
      .toBe(`/api/images/prompt?prompt=Coffee&width=400&height=400&site_id=${siteId}`)
  },
)

it('uses forwarded host for proxy renders without trusting Origin or Referer to select an origin', () => {
  expect(publicImageDeliveryFromHeaders(headerReader({ 'x-forwarded-host': 'www.makinari.com, app.makinari.com', host: 'app.makinari.com' })).origin)
    .toBe('https://app.makinari.com')
  expect(publicImageDeliveryFromHeaders(headerReader({ 'x-forwarded-host': 'branch.preview.makinari.com', host: 'app.makinari.com', origin: 'https://www.makinari.com' })).origin)
    .toBeNull()
  expect(publicImageDeliveryFromHeaders(headerReader({ origin: 'https://www.makinari.com', referer: 'https://www.makinari.com/shop' })).origin)
    .toBeNull()
})

it('scopes generated, persisted, promotion and variant requests without copying private query overrides', () => {
  const delivery = publicImageDeliveryFromHeaders(headerReader({ host: 'www.makinari.com' }))
  const legacy = 'https://old.test/api/public/image/prompt/Coffee?width=400&height=256&token=private&cache_only=0&target=https://evil.test'
  const normalized = normalizePromptImageUrl(legacy, siteId, delivery)
  expect(normalized).toBe(`https://app.makinari.com/api/images/prompt?prompt=Coffee&width=400&height=256&site_id=${siteId}&cache_only=1`)
  expect(normalizePromptImageUrl(normalized, siteId, delivery)).toBe(normalized)
  expect(resolvePromotionImage({ name: 'Deal', site_id: siteId }, 'card', delivery)).toContain('&cache_only=1')
  const gallery = buildPdpGalleryEntries({ parent: { id: 'parent', name: 'Coffee', site_id: siteId }, children: [{ id: 'variant', name: 'Large' }], delivery })
  expect(gallery[0].url).toContain(`site_id=${siteId}&cache_only=1`)
  expect(resolveItemImage({ name: 'Coffee', image_url: 'https://cdn.test/photo.png' }, undefined, delivery)).toBe('https://cdn.test/photo.png')
})