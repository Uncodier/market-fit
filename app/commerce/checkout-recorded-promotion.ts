import { roundMoney } from "./taxes"
import type { CheckoutSupabaseClient, ProcessedCheckoutLine } from "./checkout-types"

type StoredLine = {
  id: string
  catalog_item_id: string | null
  quantity: number
  unit_price: number
  status: string | null
  parent_sale_order_item_id: string | null
  metadata: { client_line_key?: string; modifier_group_id?: string } | null
}

const RECORDED_FIELDS = ["promotion_id", "discount_total", "subtotal", "tax_total", "shipping_cost", "total", "currency",
  "buyer_user_id", "origin_location_id", "fulfillment_method", "updated_at"]

export function recordedPromotionVersion(order: Record<string, unknown>): string {
  return JSON.stringify(RECORDED_FIELDS.map((key) => order[key] ?? null))
}

/** Only an unchanged, server-owned discount may survive as an existing redemption. */
export async function loadRecordedCheckoutPromotion(client: CheckoutSupabaseClient, params: {
  siteId: string
  source: string
  effectiveExistingOrderId?: string
  promotionId?: string
  promotionCode?: string
  processedLines: ProcessedCheckoutLine[]
  orderSubtotal: number
  orderTaxTotal: number
  orderShippingCost: number
  orderCurrency: string
  buyerUserId?: string | null
  finalLeadId?: string | null
  finalOriginLocationId?: string | null
  fulfillment: string
}): Promise<{ promotionId: string; discount: number; version: string } | null> {
  if (params.source !== "pos" || !params.effectiveExistingOrderId ||
    (!params.promotionId && !params.promotionCode?.trim())) return null
  const { data: order, error } = await client.from("sale_orders").select(`
    promotion_id, discount_total, subtotal, tax_total, shipping_cost, total, currency, buyer_user_id,
    origin_location_id, fulfillment_method, updated_at,
    sales (lead_id, source),
    promotions (code), sale_order_items (
      id, catalog_item_id, quantity, unit_price, status, parent_sale_order_item_id, metadata
    )
  `).eq("site_id", params.siteId).eq("id", params.effectiveExistingOrderId).single()
  if (error || !order) throw new Error("Unable to verify the recorded order promotion.")
  if (!order.promotion_id || Number(order.discount_total) <= 0) return null
  // An unassigned online origin is not a redeemed-location constraint. Register
  // authorization still owns the collection location; a stored origin is immutable here.
  if (order.fulfillment_method !== params.fulfillment ||
    (order.origin_location_id !== null &&
      (typeof order.origin_location_id !== "string" || !order.origin_location_id ||
        order.origin_location_id !== params.finalOriginLocationId))) return null
  if ((order.buyer_user_id || null) !== (params.buyerUserId || null) ||
    (order.sales?.lead_id || null) !== (params.finalLeadId || null)) return null
  if (params.promotionId ? params.promotionId !== order.promotion_id :
    params.promotionCode?.trim().toUpperCase() !== order.promotions?.code?.trim().toUpperCase()) return null
  // A different typed code must never inherit a discount by supplying its old ID.
  if (params.promotionCode?.trim() && order.promotions?.code &&
    params.promotionCode.trim().toUpperCase() !== order.promotions.code.trim().toUpperCase()) return null
  const discount = Number(order.discount_total)
  const subtotal = Number(order.subtotal)
  const tax = Number(order.tax_total ?? 0)
  const shipping = Number(order.shipping_cost ?? 0)
  if (!Number.isFinite(discount) || discount > subtotal || discount > params.orderSubtotal || order.currency !== params.orderCurrency ||
    roundMoney(subtotal - discount + tax + shipping) !== roundMoney(Number(order.total))) return null

  const rows: StoredLine[] = Array.isArray(order.sale_order_items) ? order.sale_order_items : []
  const parents = new Map(rows.filter((row) => !row.parent_sale_order_item_id && row.status !== "cancelled")
    .map((row) => [row.id, row]))
  const active = rows.filter((row) => row.status !== "cancelled" &&
    (!row.parent_sale_order_item_id || parents.has(row.parent_sale_order_item_id)))
  if (!active.length) return null
  const lines = new Map(params.processedLines.map(line => [line.client_line_key, line]))
  if (lines.size !== params.processedLines.length) return null
  let added = params.processedLines.length > active.length
  const originalHosts = new Set<string>()
  const originalLines = new Map(lines)
  for (const row of active) {
    const parent = row.parent_sale_order_item_id ? parents.get(row.parent_sale_order_item_id) : null
    const parentKey = parent ? parent.metadata?.client_line_key || parent.id : null
    const key = row.metadata?.client_line_key || (parentKey
      ? `${parentKey}:mod:${row.metadata?.modifier_group_id || "g"}:${row.catalog_item_id}` : row.id)
    const line = lines.get(key)
    if (!line || line.parent_client_line_key !== parentKey || row.catalog_item_id !== line.catalog_item_id ||
      Number(row.unit_price) !== line.unit_price || !(line.quantity >= Number(row.quantity))) return null
    if (parent && parentKey) {
      const host = originalLines.get(parentKey)
      if (!host || line.modifier_group_id !== (row.metadata?.modifier_group_id || null) ||
        line.quantity * Number(parent.quantity) !== Number(row.quantity) * host.quantity) return null
    } else {
      originalHosts.add(key)
    }
    added ||= line.quantity > Number(row.quantity)
    lines.delete(key)
  }
  if (added) {
    // Keep the historical amount, not a new POS redemption or a discount on the additions.
    if (order.sales?.source !== "shop" || roundMoney(params.orderSubtotal) < roundMoney(subtotal) ||
      [...lines.values()].some(line => line.parent_client_line_key && originalHosts.has(line.parent_client_line_key))) return null
  } else if (roundMoney(params.orderSubtotal) !== roundMoney(subtotal) || params.orderTaxTotal !== tax ||
    params.orderShippingCost !== shipping) return null
  return { promotionId: order.promotion_id, discount, version: recordedPromotionVersion(order) }
}