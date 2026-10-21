/** @jest-environment node */

import nextConfig from '../../next.config'
import { hasRemoteMatch } from 'next/dist/shared/lib/match-remote-pattern'
import { ecomContext } from '@/lib/demo-data/ecom/context'
import { habituallContext } from '@/lib/demo-data/habituall/context'
import { saasContext } from '@/lib/demo-data/saas/context'
import { makeItem } from '@/lib/demo-data/factories'

function isAllowed(src: string) {
  return hasRemoteMatch([], nextConfig.images.remotePatterns, new URL(src))
}

describe('demo image remote patterns', () => {
  it.each([
    ecomContext.sitesPatch.logo_url,
    habituallContext.sitesPatch.logo_url,
    saasContext.sitesPatch.logo_url,
    makeItem('demo-product', 'demo-site', {
      name: 'Demo product',
      kind: 'product',
      target_sale_price: 10,
    }).image_url,
    'https://picsum.photos/seed/moda-rapida-hero/1200/600',
  ])('allows the seeded demo image %s', (src) => {
    expect(isAllowed(src)).toBe(true)
  })

  it.each([
    'http://picsum.photos/seed/moda-rapida-logo/200/200',
    'https://picsum.photos:8443/seed/moda-rapida-logo/200/200',
    'https://picsum.photos/seed/moda-rapida-logo/200/200?unexpected=1',
    'https://other.picsum.photos/seed/moda-rapida-logo/200/200',
    'https://picsum.photos.example.com/seed/moda-rapida-logo/200/200',
    'https://picsum.photos/200/200',
  ])('rejects URLs outside the seeded HTTPS image pattern: %s', (src) => {
    expect(isAllowed(src)).toBe(false)
  })

  it('preserves the existing storage image allowlist', () => {
    expect(isAllowed('https://db.makinari.com/storage/v1/object/public/logos/site.png')).toBe(true)
  })
})