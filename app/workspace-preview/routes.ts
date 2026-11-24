import { getNavKeyForPath } from '@/lib/auth/screen-access'
import type { DirectoryScreen } from './loaders/directories'
import type { WorkspacePreviewLoader } from './types'

export interface PreviewRoute { screen: string; load: WorkspacePreviewLoader }
const directory = (screen: DirectoryScreen): PreviewRoute => ({ screen,
  load: async input => (await import('./loaders/directories')).directoryPreview(screen, input),
})

// Exact, unfiltered indexes. Never infer access from the table name, URL prefix,
// a client-provided site, or another screen (catalog/modifiers and robot modes differ).
const routes = new Map<string, PreviewRoute>([
  ['/leads', { screen: 'leads', load: async input => (await import('./loaders/crm')).leadsPreview(input) }],
  ['/deals', { screen: 'deals', load: async input => (await import('./loaders/crm')).dealsPreview(input) }],
  ['/control-center', { screen: 'controlCenter', load: async input => (await import('./loaders/crm')).tasksPreview(input) }],
  ['/orders', { screen: 'orders', load: async input => (await import('./loaders/operations')).ordersPreview(input) }],
  ['/order-lines', { screen: 'orderLines', load: async input => (await import('./loaders/order-lines')).orderLinesPreview(input) }],
  ['/quotations', { screen: 'quotations', load: async input => (await import('./loaders/finance')).quotationsPreview(input) }],
  ['/subscriptions', { screen: 'subscriptions', load: async input => (await import('./loaders/documents')).subscriptionsPreview(input) }],
  ['/bills', { screen: 'bills', load: async input => (await import('./loaders/documents')).billsPreview(input) }],
  ['/inventory', { screen: 'inventory', load: async input => (await import('./loaders/operations')).inventoryPreview(input) }],
  ['/inventory/movements', { screen: 'inventoryMovements', load: async input => (await import('./loaders/operations')).inventoryMovementsPreview(input) }],
  ['/inventory/transfers', { screen: 'inventoryTransfers', load: async input => (await import('./loaders/operations')).inventoryTransfersPreview(input) }],
  ['/shipments', { screen: 'shipments', load: async input => (await import('./loaders/operations')).shipmentsPreview(input) }],
  ['/reservations', { screen: 'reservations', load: async input => (await import('./loaders/operations')).reservationsPreview(input) }],
  ['/suppliers', { screen: 'suppliers', load: async input => (await import('./loaders/buying')).suppliersPreview(input) }],
  ['/purchases/requests', { screen: 'purchaseRequests', load: async input => (await import('./loaders/buying')).purchaseRequestsPreview(input) }],
  ['/purchases/tenders', { screen: 'procurementTenders', load: async input => (await import('./loaders/buying')).procurementTendersPreview(input) }],
  ['/robots?mode=workflow', { screen: 'workflows', load: async input => (await import('./loaders/operations')).robotsPreview(input) }],
  ['/campaigns', directory('campaigns')], ['/segments', directory('segments')],
  ['/assets', directory('assets')], ['/content', directory('content')], ['/promotions', directory('promotions')],
  ['/catalog', directory('catalog')], ['/catalog/modifier-groups', directory('modifierGroups')],
  ['/price-lists', directory('priceLists')], ['/records', directory('records')],
  ['/requirements', directory('requirements')], ['/agents', directory('agentsConfiguration')],
])

export function workspacePreviewRoute(pathname: string, search: string): PreviewRoute | undefined {
  const signature = search ? `${pathname}?${search}` : pathname
  const route = routes.get(signature)
  return route && getNavKeyForPath(pathname, new URLSearchParams(search)) === route.screen ? route : undefined
}