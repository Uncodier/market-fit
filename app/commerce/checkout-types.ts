export interface CheckoutLineModifier {
  catalogItemId: string
  quantity: number
  unitPriceOverride?: number
  groupId?: string
}

export interface CheckoutLine {
  catalogItemId: string
  quantity: number
  unitPriceOverride?: number
  reservationStart?: string
  reservationEnd?: string
  clientLineKey?: string
  modifiers?: CheckoutLineModifier[]
}

export interface CheckoutCartParams {
  siteId: string
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
    method: string
    amount: number
    tendered?: number
    change?: number
  }[]
  existingOrderId?: string
  intent?: "draft" | "send" | "complete" | "pay"
  paymentMethod?: string
  scheduledFor?: string
  clientMutationId?: string
  quotationId?: string
  publicAccessToken?: string
  notes?: string
  existingReservationId?: string
  isStaffMutation?: boolean
}

export type CheckoutSource = CheckoutCartParams["source"]
export type CheckoutSupabaseClient = any

export type ProcessedCheckoutLine = {
  site_id: string
  catalog_item_id: string
  name: string
  description?: string | null
  currency: string
  quantity: number
  unit_price: number
  subtotal: number
  is_reservation_dropin: boolean
  reservationStart?: string
  reservationEnd?: string
  isRoundRobinDropin: boolean
  client_line_key: string
  parent_client_line_key: string | null
  modifier_group_id: string | null
  parent_name: string | null
}
