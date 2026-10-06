/** @jest-environment node */

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { JSDOM } from 'jsdom'
import { PromoBundleExperience, type PromoBundleData } from '@/app/components/commerce/PromoBundleExperience'
import { PublicImageDelivery } from '@/app/components/commerce/PublicImageDelivery'
import { getCartItems, setCartItems } from '@/app/commerce/cart-storage'
import type { PromptImageDelivery } from '@/app/lib/prompt-image-url'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '', locale: 'en' }) }))
jest.mock('@/app/context/DisplayCurrencyContext', () => ({ useDisplayCurrency: () => ({ formatPrice: (price: number) => `$${price}` }) }))
jest.mock('@/app/commerce/cart-storage', () => ({ getCartItems: jest.fn(), setCartItems: jest.fn() }))
jest.mock('@/app/components/commerce/PromoStorefrontShell', () => ({
  PromoStorefrontShell: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}))

const siteId = '00000000-0000-4000-8000-000000000001'
const otherSite = '00000000-0000-4000-8000-000000000002'
const promotionId = '00000000-0000-4000-8000-000000000003'
const itemId = '00000000-0000-4000-8000-000000000004'
const publicDelivery: PromptImageDelivery = { scope: 'public', origin: 'https://app.makinari.com' }
const promo: PromoBundleData = { id: promotionId, site_id: siteId, name: 'Artisan bundle',
  discount_type: 'percentage', discount_value: 10 }
const item = { id: itemId, name: 'Blue mug', image_url: null, site_id: otherSite, target_sale_price: 25 }

function images(data: PromoBundleData, surface: 'shop' | 'marketplace', delivery = publicDelivery) {
  expect(typeof window).toBe('undefined')
  const tree = <PublicImageDelivery delivery={delivery}>
    <PromoBundleExperience promo={data} surface={surface} backHref={`/${surface}`} siteSlug="artisan" />
  </PublicImageDelivery>
  const html = renderToStaticMarkup(tree)
  const dom = new JSDOM(html)
  try {
    expect(html).not.toContain('/_next/image')
    return Array.from(dom.window.document.querySelectorAll('img')).map(image => image.getAttribute('src') || '')
  } finally {
    dom.window.close()
  }
}

function publicRequest(src: string, resourceType: string, resourceId: string, delivery = publicDelivery) {
  expect(src.startsWith(`${delivery.origin || ''}/api/images/prompt?`)).toBe(true)
  const url = new URL(src, 'https://local.example.test')
  expect(url.searchParams.get('public')).toBe('1')
  expect(url.searchParams.get('site_id')).toBe(siteId)
  expect(url.searchParams.get('resource_type')).toBe(resourceType)
  expect(url.searchParams.get('resource_id')).toBe(resourceId)
  expect(url.searchParams.has('cache_only')).toBe(false)
  for (const key of ['token', 'authorization', 'x-api-key', 'origin']) expect(url.searchParams.has(key)).toBe(false)
}

beforeEach(() => { jest.clearAllMocks() })
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled()
  expect(getCartItems).not.toHaveBeenCalled()
  expect(setCartItems).not.toHaveBeenCalled()
})

it.each(['shop', 'marketplace'] as const)('SSR promotion hero on %s is a native public site/resource request without workspace state', surface => {
  const requests = images(promo, surface)
  expect(requests).toHaveLength(1)
  publicRequest(requests[0], 'promotion', promotionId)
})

it.each(['shop', 'marketplace'] as const)('SSR required-item image on %s uses promotion site rather than stale joined item site', surface => {
  const requests = images({ ...promo, required_items: [{ catalog_item_id: itemId, min_quantity: 1, item }] }, surface)
  expect(requests).toHaveLength(2)
  publicRequest(requests[0], 'promotion', promotionId)
  publicRequest(requests[1], 'catalog', itemId)
  expect(requests[1]).not.toContain(otherSite)
})

it.each(['shop', 'marketplace'] as const)('SSR category-pick image on %s uses native public delivery and promotion tenant', surface => {
  const requests = images({ ...promo, category_pick_items: [item] }, surface)
  expect(requests).toHaveLength(2)
  publicRequest(requests[0], 'promotion', promotionId)
  publicRequest(requests[1], 'catalog', itemId)
})

it('keeps local/preview SSR relative but explicitly public and resource-scoped', () => {
  const delivery: PromptImageDelivery = { scope: 'public', origin: null }
  const requests = images({ ...promo, category_pick_items: [item] }, 'shop', delivery)
  publicRequest(requests[0], 'promotion', promotionId, delivery)
  publicRequest(requests[1], 'catalog', itemId, delivery)
})

it('normalizes persisted legacy promotion image URLs without preserving credential or tenant overrides', () => {
  const image_url = `https://old.example.test/api/public/image/prompt/Legacy?site_id=${otherSite}&token=private&authorization=forged&public=0`
  const requests = images({ ...promo, image_url }, 'marketplace')
  expect(requests).toHaveLength(1)
  publicRequest(requests[0], 'promotion', promotionId)
  expect(new URL(requests[0]).searchParams.get('prompt')).toBe('Legacy')
  expect(requests[0]).not.toContain(otherSite)
})

it('preserves uploaded promotion and catalog image URLs as native media', () => {
  const requests = images({ ...promo, image_url: 'https://cdn.example.test/promotion.png',
    category_pick_items: [{ ...item, image_url: 'https://cdn.example.test/product.png' }] }, 'shop')
  expect(requests).toHaveLength(2)
  expect(requests[0]).toContain('https://cdn.example.test/promotion.png')
  expect(requests[1]).toContain('https://cdn.example.test/product.png')
  expect(requests.every(src => !src.includes('/api/images/prompt'))).toBe(true)
})