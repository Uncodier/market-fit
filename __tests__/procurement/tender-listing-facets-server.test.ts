/** @jest-environment node */
import { loadTenderListingFacets } from '@/app/tenders/load-listing-facets'
import { loadPublicTenders } from '@/app/tenders/public-data'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { loadMarketplaceAreas } from '@/app/marketplace/load-marketplace-regions'
import type { PublicTenderRow } from '@/app/tenders/public-data'

jest.mock('server-only', () => ({}))
jest.mock('@/app/tenders/demo-mode', () => ({ isProcurementPortalDemo: async () => false }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock('@/app/marketplace/load-marketplace-regions', () => ({ loadMarketplaceAreas: jest.fn() }))
jest.mock('@/app/tenders/site-identity', () => ({ loadTenderSiteIdentities: jest.fn(async () => new Map()) }))
const item = '00000000-0000-4000-8000-000000000001'
const row = { publication_id: 'publication', version: 6, snapshot: { requirements: [{ id: 'line' }] } } as PublicTenderRow
let queries: Record<string, Record<string, jest.Mock>>
let data: Record<string, unknown>
let errors: Record<string, unknown>

beforeEach(() => {
  jest.clearAllMocks()
  queries = {}; errors = {}
  data = {
    procurement_tender_publications: [{ id: 'publication', tender_id: 'tender', site_id: 'site', version: 6 }],
    procurement_tender_audit: { snapshot: { requirements: [{ id: 'line', catalog_item_id: item }, { id: 'not-published', catalog_item_id: '00000000-0000-4000-8000-000000000002' }] } },
    catalog_items: [{ category_id: 'category' }], catalog_categories: [{ id: 'category', name: 'Food' }],
  }
  const from = jest.fn((table: string) => {
    const query: Record<string, jest.Mock> = {}
    for (const method of ['select', 'in', 'eq', 'limit']) query[method] = jest.fn(() => query)
    query.maybeSingle = jest.fn(async () => ({ data: data[table], error: errors[table] ?? null }))
    query.then = jest.fn(resolve => resolve({ data: data[table], error: errors[table] ?? null }))
    queries[table] = query
    return query
  })
  jest.mocked(createServiceClient).mockResolvedValue({ from } as never)
  jest.mocked(loadMarketplaceAreas).mockResolvedValue(new Map([['site', [{ country: 'MX' }, { country: 'Mexico' }, { country: 'Unknown' }]]]))
})

test('uses only published-version product links and same-site active categories; returns names and countries only', async () => {
  const result = await loadTenderListingFacets([row])
  expect(result.get('publication')).toEqual({ regions: [{ value: 'mexico', label: 'Mexico' }], categories: [{ value: 'food', label: 'Food' }] })
  expect(queries.procurement_tender_publications.in).toHaveBeenCalledWith('id', ['publication'])
  expect(queries.procurement_tender_audit.eq).toHaveBeenCalledWith('version', 6)
  expect(queries.procurement_tender_audit.eq).toHaveBeenCalledWith('event', 'saved')
  expect(queries.procurement_tender_audit.eq).toHaveBeenCalledWith('site_id', 'site')
  expect(queries.catalog_items.in).toHaveBeenCalledWith('id', [item])
  for (const table of ['catalog_items', 'catalog_categories']) {
    expect(queries[table].eq).toHaveBeenCalledWith('site_id', 'site')
    expect(queries[table].eq).toHaveBeenCalledWith('status', 'active')
  }
  expect(JSON.stringify([...result.values()])).not.toMatch(/site_id|catalog_item_id|category_id|snapshot/)
})

test('missing saved links do not fall back to a later working tender', async () => {
  data.procurement_tender_audit = null
  expect((await loadTenderListingFacets([row])).get('publication')?.categories).toEqual([])
  expect(queries.catalog_items).toBeUndefined()
})

test('does not enrich unexpected publications or mismatched versions', async () => {
  data.procurement_tender_publications = [{ id: 'foreign', site_id: 'foreign-site', version: 6 }, { id: 'publication', site_id: 'site', version: 7 }]
  expect(await loadTenderListingFacets([row])).toEqual(new Map())
  expect(queries.procurement_tender_audit).toBeUndefined()
})

test('denied public RPC never reaches service-role enrichment', async () => {
  jest.mocked(createClient).mockResolvedValue({ rpc: jest.fn(async () => ({ data: null, error: { message: 'denied' } })) } as never)
  expect((await loadPublicTenders()).error).toBe('Tender publications are temporarily unavailable.')
  expect(createServiceClient).not.toHaveBeenCalled()
})

test('empty pages skip privileged reads and database errors are not fabricated empty facets', async () => {
  expect(await loadTenderListingFacets([])).toEqual(new Map())
  expect(createServiceClient).not.toHaveBeenCalled()
  errors.catalog_categories = { message: 'unavailable' }
  await expect(loadTenderListingFacets([row])).rejects.toThrow('temporarily unavailable')
})