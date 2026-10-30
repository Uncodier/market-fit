import { getUserSites, listBuyerLibrary, listBuyerOrders, listBuyerQuotes, listBuyerSubscriptions } from '@/app/buyer/actions'
import { readPortalJson } from '../submissions/types'
import { listSearchReservations, listSearchTenders } from './actions'
import { normalizeSearchRows } from './normalize'
import type { SearchCollection, SearchSource } from './types'
import type { PublicTenderRow } from '@/app/tenders/public-data'

type PageResult<T> = { data?: T[]; count?: number; error?: string }

/** Read every available page, never silently represent the first page as the full collection. */
export async function readSearchPages<T>(load: (page: number) => Promise<PageResult<T>>, pageSize = 100): Promise<T[]> {
  const rows: T[] = []
  for (let page = 1; page <= 100; page++) {
    const result = await load(page)
    if (result.error || !result.data) throw new Error('Collection unavailable')
    rows.push(...result.data)
    if (result.count !== undefined ? rows.length >= result.count : result.data.length < pageSize) return rows
  }
  throw new Error('Refine the search in the collection to see all records')
}

export async function loadSearchSources(query: string): Promise<SearchSource[]> {
  const source = async (collection: SearchCollection, load: () => Promise<Parameters<typeof normalizeSearchRows>[1]>): Promise<SearchSource> => {
    try { return { collection, rows: normalizeSearchRows(collection, await load()) } }
    catch { return { collection, rows: [], error: true } }
  }
  return Promise.all([
    source('orders', () => readSearchPages(page => listBuyerOrders({ page, pageSize: 100, scope: 'personal' }))),
    source('quotes', () => readSearchPages(page => listBuyerQuotes({ page, pageSize: 100, scope: 'personal' }))),
    source('subscriptions', () => readSearchPages(page => listBuyerSubscriptions({ page, pageSize: 100, scope: 'personal' }))),
    source('library', () => readSearchPages(page => listBuyerLibrary({ page, pageSize: 100, scope: 'personal' }))),
    source('reservations', () => readSearchPages(listSearchReservations)),
    source('businesses', async () => { const result = await getUserSites(); if (result.error) throw new Error(result.error); return result.data ?? [] }),
    source('credentials', async () => (await readPortalJson('/api/procurement/credentials')).credentials),
    source('submissions', async () => (await readPortalJson('/api/procurement/commerce/submissions')).data),
    source('drafts', async () => (await readPortalJson('/api/procurement/credentials/drafts/list')).drafts),
    source('opportunities', async () => (await readPortalJson('/api/procurement/credentials/participation')).opportunities),
    source('tenders', () => readSearchPages<PublicTenderRow>(page => listSearchTenders(query, page), 25)),
    source('products', async () => {
      let searchId: string | undefined
      return readSearchPages(async page => {
        const params = new URLSearchParams({ search: query, page: String(page), limit: '100' })
        if (searchId) params.set('search_id', searchId)
        const result = await readPortalJson(`/api/marketplace/products?${params}`)
        if (result.candidate_window_truncated) throw new Error('Catalog search window exceeded')
        searchId = result.search_id
        return { data: result.data, count: result.count }
      })
    }),
  ])
}