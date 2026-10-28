import type { CatalogItem } from "@/app/types"
import type { RelationSelectValue } from "@/app/components/ui/relation-select"
import { buildCartFromSaleOrderItems } from "@/app/pos/populate-cart-from-order"
import { isPosOpenOrder } from "@/app/pos/open-orders"
import {
  EMPTY_POS_SHIPPING_ADDRESS,
  type PosShippingAddress,
} from "@/app/pos/shipping-address"
import { sentLineQuantitiesFromSaleOrderItems } from "@/app/pos/send-delta"
import { recordedPosOrderPromo } from "@/app/pos/recorded-order-promo"

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isFiniteNumeric(value: unknown): boolean {
  return (typeof value === "number" || hasText(value)) && Number.isFinite(Number(value))
}

/** Require editable active lines, not nullable catalog references in cancelled history. */
export function hasPosOrderCartSnapshot(order: unknown): boolean {
  if (!isRecord(order) || !Array.isArray(order.sale_order_items)) return false
  const rows = order.sale_order_items
  if (!rows.every(isRecord)) return false

  const cancelledParentIds = new Set(rows.filter((line) =>
    line.status === "cancelled" && !line.parent_sale_order_item_id && hasText(line.id),
  ).map((line) => line.id))
  // Reconstruction nests children only under active parents; cancelled parents' children are history too.
  const active = rows.filter((line) => line.status !== "cancelled" &&
    !cancelledParentIds.has(line.parent_sale_order_item_id))
  if (!active.every((line) =>
    hasText(line.id) && hasText(line.catalog_item_id) && hasText(line.name) &&
    isFiniteNumeric(line.unit_price) && isFiniteNumeric(line.quantity) && Number(line.quantity) > 0 &&
    "metadata" in line && (line.metadata === null || isRecord(line.metadata)) &&
    "parent_sale_order_item_id" in line &&
    (line.parent_sale_order_item_id === null || hasText(line.parent_sale_order_item_id)),
  )) return false

  const parentIds = new Set(active.filter((line) => line.parent_sale_order_item_id === null).map((line) => line.id))
  return parentIds.size > 0 && active.every((line) =>
    line.parent_sale_order_item_id === null || parentIds.has(line.parent_sale_order_item_id),
  )
}

export function posSessionFromOrder(
  order: any,
  catalogItems: CatalogItem[],
) {
  if (!isPosOpenOrder(order)) return null

  const leadValue: RelationSelectValue = order.leads
    ? {
        mode: "existing",
        id: order.leads.id,
        label: order.leads.name || order.leads.email,
      }
    : null
  const address = order.shipping_address
  const shippingAddress: PosShippingAddress =
    address && typeof address === "object"
      ? {
          line1: address.line1 || "",
          line2: address.line2 || "",
          city: address.city || "",
          state: address.state || "",
          zip: address.zip || "",
          country: address.country || "",
        }
      : EMPTY_POS_SHIPPING_ADDRESS
  const recordedPaymentTotal = Array.isArray(order.sales?.payments)
    ? order.sales.payments.reduce(
        (sum: number, payment: { amount?: number | string | null }) =>
          sum + (Number(payment.amount) || 0),
        0,
      )
    : 0
  const paidFromBalance =
    order.sales?.amount_due != null
      ? Math.max(
          0,
          (Number(order.sales?.amount) || Number(order.total) || 0) -
            Number(order.sales.amount_due),
        )
      : 0
  const existingPaymentTotal = Math.max(
    recordedPaymentTotal,
    paidFromBalance,
  )

  return {
    cart: order.sale_order_items
      ? buildCartFromSaleOrderItems(order.sale_order_items, catalogItems, order.currency)
      : null,
    sentLineQuantities: sentLineQuantitiesFromSaleOrderItems(
      order.sale_order_items || [],
    ),
    leadValue,
    fulfillment: order.fulfillment_method || "dine_in",
    originLocationId: order.origin_location_id || "",
    priceListId: order.price_list_id || "none",
    orderNotes: typeof order.notes === "string" ? order.notes : "",
    buyerUserId: order.buyer_user_id || null,
    sellerUserId: order.seller_user_id || null,
    sellerName:
      order.seller?.name || order.seller?.email || order.seller_name ||
      (order.seller_user_id ? "Seller unavailable" : null),
    shippingAddress,
    existingPaymentTotal,
    recordedOrderPromo: recordedPosOrderPromo(order),
  }
}
