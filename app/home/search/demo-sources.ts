import { demoAccountLibrary, demoAccountOrders, demoAccountQuotes, demoAccountSubscriptions } from '../demo-commerce'
import { getDemoHomeSummary } from '../demo-summary'
import { demoPortalCredentials, demoPortalDrafts, demoPortalOpportunities, demoPortalSubmissions,
  demoPublicTenders } from '@/lib/demo-data/procurement-portal'
import { normalizeSearchRows } from './normalize'
import type { SearchCollection, SearchSource } from './types'

export function demoSearchSources(): SearchSource[] {
  const summary = getDemoHomeSummary()
  const sources: [SearchCollection, Parameters<typeof normalizeSearchRows>[1]][] = [
    ['orders', demoAccountOrders], ['quotes', demoAccountQuotes], ['subscriptions', demoAccountSubscriptions],
    ['library', demoAccountLibrary], ['reservations', [...summary.activeReservations, ...summary.recentReservations]],
    ['businesses', [{ id: 'demo-acme', name: 'Acme Workplace' }, { id: 'demo-northstar', name: 'Northstar Technology' }]],
    ['credentials', demoPortalCredentials], ['drafts', demoPortalDrafts], ['submissions', demoPortalSubmissions],
    ['opportunities', demoPortalOpportunities], ['tenders', demoPublicTenders],
    ['products', demoAccountOrders.slice(0, 3).map(row => ({ id: row.sale_order_items[0].catalog_item.id,
      name: row.sale_order_items[0].name, description: 'Workspace equipment', site: row.site }))],
  ]
  return sources.map(([collection, rows]) => ({ collection, rows: normalizeSearchRows(collection, rows, true) }))
}