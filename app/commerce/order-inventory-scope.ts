import 'server-only'
import { isSelfServiceOrder } from './self-service-lifecycle'

type InventoryScopeOrder = {
  items?: unknown
  sale?: { source?: string | null } | { source?: string | null }[] | null
}
type InventoryScopeQuery = {
  eq: (column: string, value: string) => InventoryScopeQuery
  maybeSingle: () => PromiseLike<{ data: InventoryScopeOrder | null; error?: unknown }>
}
type InventoryScopeClient = {
  from: (table: string) => { select: (columns: string) => InventoryScopeQuery }
}

/** Resolve inventory ownership only from a site-filtered, persisted order. */
export async function usesOrderLineInventoryReceipts(
  client: InventoryScopeClient, siteId: string, orderId: string,
): Promise<boolean> {
  const { data: order, error } = await client.from('sale_orders')
    .select('id, items, sale:sales(source)').eq('site_id', siteId).eq('id', orderId).maybeSingle()
  if (error || !order) throw new Error('Order inventory ownership could not be verified')
  const sale = Array.isArray(order.sale) ? order.sale[0] : order.sale
  return sale?.source === 'pos' && !isSelfServiceOrder(order)
}