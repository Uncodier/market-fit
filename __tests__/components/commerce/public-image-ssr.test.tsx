/** @jest-environment node */

import React, { act } from 'react'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { headers } from 'next/headers'
import ShopLayout from '@/app/shop/layout'
import MarketplaceLayout from '@/app/marketplace/layout'
import CartLayout from '@/app/cart/layout'
import BookLayout from '@/app/book/layout'
import { ProgressiveImage } from '@/app/components/commerce/ProgressiveImage'
import { CatalogListingCard } from '@/app/components/commerce/CatalogListingCard'
import { PromptImage } from '@/app/components/commerce/PromptImage'
import { PdpHeroGallery } from '@/app/components/commerce/pdp/PdpHeroGallery'
import { PdpProductGallery } from '@/app/components/commerce/pdp/PdpProductGallery'
import { buildPdpGalleryEntries } from '@/app/lib/image-utils'
import type { CatalogItem } from '@/app/types'

jest.mock('next/headers', () => ({ headers: jest.fn() }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))
jest.mock('@/app/context/DisplayCurrencyContext', () => ({ useDisplayCurrency: () => ({ formatPrice: (price: number) => `$${price}` }) }))

const siteId = '00000000-0000-4000-8000-000000000001'
const item = { id: 'coffee', name: 'Coffee', site_id: siteId, kind: 'product', metadata: {}, _shop: { sellable: true } } as CatalogItem
const legacy = `https://old.test/api/public/image/prompt/Latte?width=512&height=256&site_id=${siteId}&token=private&cache_only=0`

function PublicImages() {
  const entries = buildPdpGalleryEntries({ parent: item, children: [{ id: 'large', name: 'Large' }], size: 'full' })
  return <>
    <CatalogListingCard item={item} href="/shop/cafe/coffee" onPrimaryAction={() => {}} />
    <ProgressiveImage item={item} alt="Shop hero" loading="eager" fetchPriority="high" />
    <ProgressiveImage directUrl={legacy} alt="Persisted" />
    <PdpHeroGallery entries={entries} itemName="Variant hero" />
    <PdpProductGallery itemName="Product gallery" mainSrc={entries[0].url} entries={entries} selectedIndex={0} onThumbClick={() => {}} />
    <PromptImage src="https://cdn.test/upload.png" srcSet="https://cdn.test/small.png 1x, https://cdn.test/large.png 2x" alt="Upload" />
  </>
}

function imageRequests(document: Document) {
  return Array.from(document.querySelectorAll('img')).flatMap(image => [
    image.getAttribute('src') || '',
    ...(image.getAttribute('srcset')?.split(/,\s*/).map(candidate => candidate.split(/\s+/)[0]) || []),
  ]).filter(url => url.includes('/api/images/prompt'))
}

function imageAttributes(document: Document) {
  return Array.from(document.querySelectorAll('img')).map(image => ({
    src: image.getAttribute('src'), srcSet: image.getAttribute('srcset'), sizes: image.getAttribute('sizes'),
  }))
}

async function publicTree(host: string, children = <PublicImages />) {
  jest.mocked(headers).mockResolvedValue({ get: (key: string) => key === 'host' ? host : null } as Awaited<ReturnType<typeof headers>>)
  return ShopLayout({ children })
}

it.each(['www.makinari.com', 'makinari.com', 'app.makinari.com'])(
  'renders initial HTML src/srcset on %s without window or relative www API requests', async host => {
    expect(typeof window).toBe('undefined')
    const tree = await publicTree(host)
    const dom = new JSDOM(renderToStaticMarkup(tree), { url: `https://${host}/shop/cafe` })
    const requests = imageRequests(dom.window.document)
    expect(requests.length).toBeGreaterThan(10)
    for (const request of requests) {
      const url = new URL(request)
      expect(url.origin).toBe('https://app.makinari.com')
      expect(url.searchParams.get('cache_only')).toBe('1')
      expect(url.searchParams.get('site_id')).toBe(siteId)
      expect(url.searchParams.has('token')).toBe(false)
    }
    const hero = dom.window.document.querySelector('img[alt="Shop hero"][loading]')
    expect(hero?.getAttribute('loading')).toBe('eager')
    expect(hero?.getAttribute('fetchPriority')).toBe('high')
    expect(dom.window.document.querySelector('img[alt="Upload"]')?.getAttribute('srcset'))
      .toBe('https://cdn.test/small.png 1x, https://cdn.test/large.png 2x')
    dom.window.close()
  },
)

it.each(['localhost:3000', 'branch.preview.makinari.com', 'demo.makinari.com', 'shop.example.test'])(
  'keeps public SSR relative/cache-only on %s and unscoped workspace images generation-capable', async host => {
    const dom = new JSDOM(renderToStaticMarkup(await publicTree(host)))
    for (const request of imageRequests(dom.window.document)) {
      expect(request.startsWith('/api/images/prompt?')).toBe(true)
      expect(request).toContain('cache_only=1')
    }
    const workspace = renderToStaticMarkup(<ProgressiveImage item={item} alt="Workspace" />)
    expect(workspace).toContain('src="/api/images/prompt?')
    expect(workspace).not.toContain('cache_only')
    dom.window.close()
  },
)

it.each([ShopLayout, MarketplaceLayout, CartLayout, BookLayout])('scopes each public route layout before rendering descendants', async Layout => {
  await publicTree('www.makinari.com')
  const html = renderToStaticMarkup(await Layout({ children: <ProgressiveImage item={item} alt="Photo" /> }))
  expect(html).toContain('src="https://app.makinari.com/api/images/prompt?')
  expect(html).toContain('cache_only=1')
})

it.each(['www.makinari.com', 'makinari.com', 'branch.preview.makinari.com', 'localhost:3000'])(
  'hydrates %s without changing src/srcset or producing mismatch warnings', async host => {
    const tree = await publicTree(host)
    const html = renderToString(tree)
    const dom = new JSDOM(`<div id="root">${html}</div>`, { url: `${host.startsWith('localhost') ? 'http' : 'https'}://${host}/shop/cafe` })
    const container = dom.window.document.getElementById('root')!
    const before = imageRequests(dom.window.document)
    const beforeAttributes = imageAttributes(dom.window.document)
    const original = new Map<string, PropertyDescriptor | undefined>()
    for (const [key, value] of Object.entries({ window: dom.window, self: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
      original.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
      Object.defineProperty(globalThis, key, { configurable: true, value })
    }
    const errors: unknown[] = []
    const consoleError = jest.spyOn(console, 'error').mockImplementation((...args) => { errors.push(args) })
    try {
      let root: ReturnType<typeof hydrateRoot> | undefined
      await act(async () => { root = hydrateRoot(container, tree, { onRecoverableError: error => errors.push(error) }) })
      expect(imageRequests(dom.window.document)).toEqual(before)
      expect(imageAttributes(dom.window.document)).toEqual(beforeAttributes)
      expect(errors).toEqual([])
      await act(async () => { root?.unmount() })
    } catch (error) {
      if (error instanceof AggregateError) throw new Error(error.errors.map(String).join('\n'))
      throw error
    } finally {
      consoleError.mockRestore()
      for (const [key, descriptor] of original) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else Reflect.deleteProperty(globalThis, key)
      }
      dom.window.close()
    }
  },
)