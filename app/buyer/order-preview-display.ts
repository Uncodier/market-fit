import type { WorkspaceOrder, OrderLine, OrderAccess } from '@/app/purchases/orders/order-document-data'
import type { BuyerOrderDetail, BuyerOrderItem, BuyerAccessItem } from './order-detail-display'

/** Preserve the workspace's display-only preview without fetching or enabling purchase actions. */
export function previewOrderDisplay(order: WorkspaceOrder): BuyerOrderDetail {
  const item = (line: OrderLine): BuyerOrderItem => ({
    ...line,
    name: line.name || line.catalog_item?.name || 'Item',
    quantity: Number(line.quantity ?? 1),
    catalog_item: line.catalog_item ? {
      name: line.catalog_item.name || undefined,
      kind: line.catalog_item.kind || undefined,
      digital_subtype: line.catalog_item.digital_subtype || undefined,
    } : undefined,
    metadata: line.metadata ? { ...line.metadata, parent_name: line.metadata.parent_name || undefined } : undefined,
  })
  const access = (entry: OrderAccess): BuyerAccessItem => ({
    id: entry.id, status: entry.status || undefined,
    catalog_item: entry.catalog_item ? {
      name: entry.catalog_item.name || undefined,
      kind: entry.catalog_item.kind || undefined,
      digital_subtype: entry.catalog_item.digital_subtype || undefined,
    } : undefined,
  })
  return {
    id: order.id, order_number: order.order_number || undefined,
    created_at: order.created_at || '', status: order.status || undefined,
    site: order.site ? { id: order.site.id, name: order.site.name || '' } : null,
    currency: order.currency || undefined,
    subtotal: order.subtotal, discount_total: order.discount_total, tax_total: order.tax_total, total: order.total,
    fulfillment_method: order.fulfillment_method, scheduled_for: order.scheduled_for,
    shipping_address: order.shipping_address,
    items: (order.items || []).map(item), sale_order_items: (order.sale_order_items || []).map(item),
    shipments: (order.shipments || []).map(shipment => ({ ...shipment, status: shipment.status || undefined })),
    sales: (order.sales || []).map(sale => ({
      ...sale, status: sale.status || undefined,
      payments: (sale.payments || []).map(payment => ({ ...payment, amount: payment.amount, date: payment.date || '' })),
    })),
    entitlements: (order.entitlements || []).map(access), reservations: (order.reservations || []).map(access),
  }
}