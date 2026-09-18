import type { CatalogItem } from "@/app/types"
import type { RelationSelectValue } from "@/app/components/ui/relation-select"
import { buildCartFromSaleOrderItems } from "@/app/pos/populate-cart-from-order"
import { isPosOpenOrder } from "@/app/pos/open-orders"
import {
  EMPTY_POS_SHIPPING_ADDRESS,
  type PosShippingAddress,
} from "@/app/pos/shipping-address"

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

  return {
    cart: order.sale_order_items
      ? buildCartFromSaleOrderItems(order.sale_order_items, catalogItems)
      : null,
    leadValue,
    priceListId: order.price_list_id || "none",
    orderNotes: typeof order.notes === "string" ? order.notes : "",
    buyerUserId: order.buyer_user_id || null,
    sellerUserId: order.seller_user_id || null,
    sellerName:
      order.seller?.name || order.seller?.email || order.seller_name || null,
    shippingAddress,
  }
}
