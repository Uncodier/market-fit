/** @jest-environment node */
import { loadTenderSiteIdentity, loadTenderSiteIdentities } from '@/app/tenders/site-identity'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveSiteInfoBySlug } from '@/app/book/site-by-slug'
import { loadPublicTenders } from '@/app/tenders/public-data'
import { createClient } from '@/lib/supabase/server'

jest.mock('server-only', () => ({}))
jest.mock('@/app/tenders/demo-mode', () => ({ isProcurementPortalDemo: async () => false }))
jest.mock('@/app/tenders/load-listing-facets', () => ({ loadTenderListingFacets: jest.fn(async () => new Map()) }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock('@/app/book/site-by-slug', () => ({
  ...jest.requireActual('@/app/book/site-by-slug'), resolveSiteInfoBySlug: jest.fn(),
}))
const portal = { slug: '829a0941-38cd-4b12-8d46-a838023042b7', sites: { name: 'My Store', logo_url: 'https://example.com/logo.png', archived_at: null } }
const expected = { slug: 'my-store', name: 'My Store', portalSlug: portal.slug, logoUrl: portal.sites.logo_url }
let query: { select: jest.Mock; eq: jest.Mock; in: jest.Mock; maybeSingle: jest.Mock; then: jest.Mock }
beforeEach(() => {
  jest.clearAllMocks()
  query = { select: jest.fn(), eq: jest.fn(), in: jest.fn(), maybeSingle: jest.fn(), then: jest.fn() }
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.in.mockReturnValue(query)
  query.maybeSingle.mockResolvedValue({ data: portal, error: null })
  query.then.mockImplementation(resolve => resolve({ data: [portal], error: null }))
  jest.mocked(createServiceClient).mockResolvedValue({ from: jest.fn(() => query) } as never)
})

test('resolves legacy portal UUIDs to the same name-derived shop slug', async () => {
  expect(await loadTenderSiteIdentity(portal.slug)).toEqual(expected)
  expect(query.eq).toHaveBeenCalledWith('enabled', true)
  expect(resolveSiteInfoBySlug).not.toHaveBeenCalled()
  expect(createServiceClient).toHaveBeenCalledWith(true, { access: 'public' })
})
test('resolves readable shop slugs back to the enabled internal portal', async () => {
  query.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
  jest.mocked(resolveSiteInfoBySlug).mockResolvedValue({ id: 'site', name: 'My Store', logo_url: null })
  expect(await loadTenderSiteIdentity('my-store')).toEqual(expected)
  expect(resolveSiteInfoBySlug).toHaveBeenCalledWith('my-store')
  expect(query.eq).toHaveBeenCalledWith('site_id', 'site')
})
test('rejects malformed paths without querying and excludes archived sites', async () => {
  expect(await loadTenderSiteIdentity('../secret')).toBeNull()
  expect(createServiceClient).not.toHaveBeenCalled()
  query.maybeSingle.mockResolvedValue({ data: { ...portal, sites: { ...portal.sites, archived_at: '2026-01-01' } }, error: null })
  jest.mocked(resolveSiteInfoBySlug).mockResolvedValue(null)
  expect(await loadTenderSiteIdentity(portal.slug)).toBeNull()
})
test('does not turn database errors into missing sites', async () => {
  query.maybeSingle.mockResolvedValue({ data: null, error: { code: '503' } })
  await expect(loadTenderSiteIdentity('my-store')).rejects.toThrow('temporarily unavailable')
})
test('enriches only RPC-authorized publications using a bounded batch', async () => {
  const rpc = jest.fn(async () => ({ data: [{ site_slug: portal.slug, title: 'Public scope' }], error: null }))
  jest.mocked(createClient).mockResolvedValue({ rpc } as never)
  expect(await loadPublicTenders(portal.slug, undefined, 0, '')).toEqual({
    rows: [{ site_slug: 'my-store', site_name: 'My Store', site_logo_url: portal.sites.logo_url, title: 'Public scope' }], error: null,
  })
  expect(rpc).toHaveBeenCalledWith('public_procurement_tenders', expect.objectContaining({ p_site_slug: portal.slug }))
  expect(query.in).toHaveBeenCalledWith('slug', [portal.slug])
  expect(query.select).toHaveBeenCalledWith('slug,sites!inner(name,logo_url,archived_at)')
})
test('empty publications need no identity query', async () => {
  expect(await loadTenderSiteIdentities([])).toEqual(new Map())
  expect(createServiceClient).not.toHaveBeenCalled()
})