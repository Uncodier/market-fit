import type { OrderLineFilter } from "./status"

export interface OrderLineParams {
  siteId: string
  status?: OrderLineFilter
  q?: string
  locationId?: string
  page?: number
  pageSize?: number
  startDate?: string
  endDate?: string
  sort?: "newest" | "oldest"
}

export interface OrderLineOrder {
  id: string
  orderNumber: string | null
  status: string | null
  fulfillmentMethod: string | null
  scheduledFor: string | null
  originLocationId: string | null
  createdAt: string
  updatedAt: string
  source: string | null
  customer: {
    id: string
    name: string
    email?: string | null
  } | null
}

export interface OrderLineAssignee {
  id: string
  name: string
}

export interface OrderLineModifier {
  id: string
  name: string
  description: string | null
  quantity: number
}

export interface OrderLineRow {
  id: string
  saleOrderItemId: string
  unitIndex: number
  unitCount: number
  saleOrderId: string
  catalogItemId: string | null
  name: string
  description: string | null
  quantity: number
  unitPrice: number
  subtotal: number
  status: string
  createdAt: string
  sentAt: string | null
  inProgressAt: string | null
  readyAt: string | null
  completedAt: string | null
  deliveredAt: string | null
  assigneeId: string | null
  shipmentId: string | null
  shipment: {
    id: string
    status: string
    createdAt: string
    updatedAt: string
    shippedAt: string | null
    deliveredAt: string | null
    estimatedDeliveryAt: string | null
  } | null
  metadata: Record<string, unknown> | null
  modifiers: OrderLineModifier[]
  order: OrderLineOrder
}

export interface OrderLinesResult {
  data: OrderLineRow[]
  count: number
  error?: string
}
