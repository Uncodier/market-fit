import 'server-only'
import { restockLegacyOrderInventory } from './restock-legacy-order-inventory'
import { reconcileOrderLineInventory, type OrderLineInventoryClient } from './order-line-inventory'
import { usesOrderLineInventoryReceipts } from './order-inventory-scope'

export { shouldRestockOrder } from './restock-legacy-order-inventory'
export type { RestockOrderLine } from './restock-legacy-order-inventory'

/** The caller must authorize cancellation/refund before supplying its database client. */
export async function restockOrderInventory(
  client: Parameters<typeof restockLegacyOrderInventory>[0] & OrderLineInventoryClient,
  order: Parameters<typeof restockLegacyOrderInventory>[1],
): Promise<void> {
  if (!await usesOrderLineInventoryReceipts(client, order.site_id, order.id)) {
    return restockLegacyOrderInventory(client, order)
  }

  // Status, current policy and shipment flags do not prove a stock movement.
  // Replays (including already-cancelled orders) reconcile the durable refund total.
  const { data: lines, error } = await client.from('sale_order_items')
    .select('id').eq('site_id', order.site_id).eq('sale_order_id', order.id)
  if (error || !Array.isArray(lines)) throw new Error('Order inventory lines could not be read')
  if (!lines.length && order.items?.length) {
    throw new Error('Inventory review required: persisted order lines are missing')
  }
  for (const line of lines) {
    // Full cancellation refunds the receipt budget, even if the line was reduced.
    // The RPC caps this supported maximum target to the actual historical debit.
    const receipt = await reconcileOrderLineInventory(client, {
      siteId: order.site_id, orderId: order.id, lineId: line.id,
      locationId: null, targetQuantity: 1_000_000_000, mode: 'restock',
    })
    if (receipt.reviewRequired) throw new Error('Inventory review required before restocking this order')
  }

  const { data: shipments, error: readError } = await client.from('shipments')
    .select('id, status').eq('site_id', order.site_id).eq('sale_order_id', order.id)
  if (readError) throw new Error('Restocked shipment status could not be read')
  for (const shipment of shipments || []) {
    const { error: updateError } = await client.from('shipments').update({
      stock_decremented: false,
      ...(shipment.status === 'delivered' ? {} : { status: 'cancelled' }),
    }).eq('site_id', order.site_id).eq('sale_order_id', order.id).eq('id', shipment.id)
    if (updateError) throw new Error('Restocked shipment status could not be confirmed')
  }
}