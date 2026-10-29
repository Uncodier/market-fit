export interface CheckoutLineModifier {
  catalogItemId: string
  quantity: number
  unitPriceOverride?: number
  /** Persisted order-line reference; its currency is resolved by the server. */
  saleOrderItemId?: string
  groupId?: string
}

export interface CheckoutLine {
  catalogItemId: string
  quantity: number
  unitPriceOverride?: number
  /** Persisted order-line reference; its currency is resolved by the server. */
  saleOrderItemId?: string
  reservationStart?: string
  reservationEnd?: string
  clientLineKey?: string
  modifiers?: CheckoutLineModifier[]
}

/** Client metadata, not authorization or operation uniqueness (clientMutationId owns that). */
export interface PosOperationIdentity {
  version: 1
  deviceId: string
  createdAt: string
}

export interface CheckoutCartParams {
  siteId: string
  /** Public kiosk location; the server derives the tenant and all payment state. */
  selfServiceLocationId?: string
  /** Short-lived signed proof for buyer attribution, never an account session. */
  buyerIdentityQr?: string
  lines: CheckoutLine[]
  priceListId?: string
  leadId?: string
  promotionCode?: string
  promotionId?: string
  fulfillment: "pickup" | "ship" | "dine_in" | "none"
  originLocationId?: string
  shippingAddress?: any
  source: "pos" | "shop" | "sales" | "marketplace" | "quote"
  userId?: string
  sellerUserId?: string
  buyerUserId?: string
  ownerSiteId?: string | null
  customerName?: string
  customerEmail?: string
  payments?: {
    /** Stable register receipt identity, retained by the POS outbox on retries. */
    paymentId?: string
    method: string
    amount: number
    tendered?: number
    change?: number
  }[]
  registerSessionId?: string
  existingOrderId?: string
  /** Original POS snapshot, checked again when a queued checkout reaches the server. */
  expectedOrderVersion?: string
  intent?: "draft" | "send" | "complete" | "pay"
  paymentMethod?: string
  scheduledFor?: string
  clientMutationId?: string
  /** Persisted once by the POS outbox; absent on legacy operations. */
  posOperationIdentity?: PosOperationIdentity
  quotationId?: string
  publicAccessToken?: string
  notes?: string
  existingReservationId?: string
  isStaffMutation?: boolean
}

export type CheckoutSource = CheckoutCartParams["source"]
export type CheckoutSupabaseClient = any

/** Persisted server result; operating scope is never taken from checkout input. */
export type PersistedCheckoutOrder = {
  id: string
  location_id?: string | null
  order_number?: string | null
  status?: string | null
  total?: number | null
  currency?: string | null
  created_at?: string | null
  notes?: string | null
  fulfillment_method?: string | null
}

export type ProcessedCheckoutLine = {
  site_id: string
  catalog_item_id: string
  name: string
  description?: string | null
  currency: string
  quantity: number
  unit_price: number
  subtotal: number
  /** Server-calculated POS shortage snapshot; does not change fulfillment status. */
  backorder_quantity?: number
  is_reservation_dropin: boolean
  reservationStart?: string
  reservationEnd?: string
  isRoundRobinDropin: boolean
  client_line_key: string
  parent_client_line_key: string | null
  modifier_group_id: string | null
  parent_name: string | null
}
