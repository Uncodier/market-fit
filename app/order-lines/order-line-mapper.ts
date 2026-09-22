import type {
  OrderLineOrder,
  OrderLineRow,
} from "./types"

export function relatedOne<T>(
  value: T | T[] | null | undefined,
): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

export type RawShipment = {
  id: string
  status: string
  created_at: string
  updated_at: string
  shipped_at?: string | null
  delivered_at?: string | null
  estimated_delivery_at?: string | null
}

export function mapOrderLine(
  row: any,
  shipmentsById: Map<string, RawShipment>,
  modifiersByItemId: Map<string, OrderLineRow["modifiers"]>,
): OrderLineRow | null {
  const item = relatedOne<any>(row.sale_order_items)
  const order = relatedOne<any>(item?.sale_orders)
  if (!item || !order) return null

  const sale = relatedOne<any>(order.sales)
  const lead = relatedOne<any>(sale?.leads)
  const shipment = row.shipment_id
    ? shipmentsById.get(row.shipment_id) || null
    : null
  const orderData: OrderLineOrder = {
    id: order.id,
    orderNumber: order.order_number || null,
    status: order.status || null,
    fulfillmentMethod: order.fulfillment_method || null,
    scheduledFor: order.scheduled_for || null,
    originLocationId: order.origin_location_id || null,
    createdAt: order.created_at,
    updatedAt: order.updated_at || order.created_at,
    source: sale?.source || null,
    customer: lead
      ? {
          id: lead.id,
          name: lead.name,
          email: lead.email || null,
        }
      : null,
  }

  return {
    id: row.id,
    saleOrderItemId: item.id,
    unitIndex: Number(row.unit_index) || 1,
    unitCount:
      Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0
        ? Number(item.quantity)
        : 1,
    saleOrderId: item.sale_order_id,
    catalogItemId: item.catalog_item_id || null,
    name: item.name,
    description: item.description || null,
    quantity: Number(row.quantity) || 0,
    unitPrice: Number(item.unit_price) || 0,
    subtotal: (Number(item.unit_price) || 0) * (Number(row.quantity) || 0),
    status: row.status || "draft",
    createdAt: row.created_at,
    sentAt: row.started_at || null,
    inProgressAt: row.in_progress_at || null,
    readyAt: row.ready_at || row.completed_at || null,
    completedAt: row.completed_at || null,
    deliveredAt: row.delivered_at || shipment?.delivered_at || null,
    assigneeId: row.assigned_to || null,
    shipmentId: row.shipment_id || null,
    shipment: shipment
      ? {
          id: shipment.id,
          status: shipment.status,
          createdAt: shipment.created_at,
          updatedAt: shipment.updated_at,
          shippedAt: shipment.shipped_at || null,
          deliveredAt: shipment.delivered_at || null,
          estimatedDeliveryAt: shipment.estimated_delivery_at || null,
        }
      : null,
    metadata:
      item.metadata && typeof item.metadata === "object" ? item.metadata : null,
    modifiers: modifiersByItemId.get(item.id) || [],
    order: orderData,
  }
}
