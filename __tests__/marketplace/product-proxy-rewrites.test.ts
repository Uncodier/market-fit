/** @jest-environment node */

import nextConfig from '../../next.config'
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match'
import { prepareDestination } from 'next/dist/shared/lib/router/utils/prepare-destination'

const originalOrigin = process.env.MARKET_FIT_ORIGIN

async function loadRewrites() {
  if (!nextConfig.rewrites) throw new Error('Conditional commerce rewrites are missing')
  const rules = await nextConfig.rewrites()
  if (!Array.isArray(rules)) throw new Error('Expected conditional commerce rewrite array')
  return rules
}

afterEach(() => {
  if (originalOrigin === undefined) delete process.env.MARKET_FIT_ORIGIN
  else process.env.MARKET_FIT_ORIGIN = originalOrigin
})

it('does not proxy the app back to itself when no origin is configured', async () => {
  delete process.env.MARKET_FIT_ORIGIN
  expect(await loadRewrites()).toEqual([])
})

it('proxies only the exact public catalog API to the configured origin with the query intact', async () => {
  process.env.MARKET_FIT_ORIGIN = 'https://commerce-origin.example'
  const rules = await loadRewrites()
  const rule = rules.find(entry => entry.source === '/api/marketplace/products')
  expect(rule).toEqual({ source: '/api/marketplace/products',
    destination: 'https://commerce-origin.example/api/marketplace/products' })
  if (!rule) throw new Error('Marketplace products rewrite is missing')
  const match = getPathMatch(rule.source, { strict: false })
  const params = match('/api/marketplace/products')
  expect(params).toEqual({})
  if (!params) throw new Error('Marketplace products rewrite did not match')
  expect(match('/api/marketplace/products/other')).toBe(false)
  expect(match('/api/marketplace/products-other')).toBe(false)
  const query = { city: 'Mexico City', country: 'MX', sort: 'featured', page: '2', limit: '36',
    search: 'Coffee & tea', priceCurrency: 'MXN', availableOnly: 'true', origin: 'https://untrusted.example' }
  const { parsedDestination } = prepareDestination({ destination: rule.destination, params, query, appendParamsToQuery: true })
  expect(parsedDestination.hostname).toBe('commerce-origin.example')
  expect(parsedDestination.pathname).toBe('/api/marketplace/products')
  expect(parsedDestination.query).toEqual(query)
})