import { v4 as uuidv4 } from "uuid"
import type { CatalogItem } from "@/app/types"
import type { PosCartItem } from "@/app/pos/components/CartPanel"

/** Rebuild POS cart lines from sale_order_items, nesting modifiers under hosts. */
export function buildCartFromSaleOrderItems(
  saleOrderItems: any[],
  catalogItems: CatalogItem[],
  orderCurrency?: string | null,
  localCheckoutSnapshot = false,
): PosCartItem[] {
  const rows = (saleOrderItems || []).filter((line) => line && line.status !== "cancelled")
  const catalogById = new Map(catalogItems.map((item) => [item.id, item]))
  const childrenByParent = new Map<string, any[]>()
  for (const oi of rows) {
    if (oi.parent_sale_order_item_id) {
      const list = childrenByParent.get(oi.parent_sale_order_item_id) || []
      list.push(oi)
      childrenByParent.set(oi.parent_sale_order_item_id, list)
    }
  }
  const parents = rows.filter((oi) => !oi.parent_sale_order_item_id)
  return parents.map((oi) => {
    const catalogItem = catalogById.get(oi.catalog_item_id)
    const childRows = childrenByParent.get(oi.id) || []
    const hostQty = Number(oi.quantity) || 1
    const modifiers = childRows.map((child) => {
      const perUnitQty = Math.max(
        1,
        Math.round(Number(child.quantity) / hostQty) || 1,
      )
      return {
        groupId: child.metadata?.modifier_group_id || "",
        catalogItemId: child.catalog_item_id,
        name: child.name,
        cartQty: perUnitQty,
        cartPrice: Number(child.unit_price) || 0,
        currency: localCheckoutSnapshot ? child.metadata?.local_currency : orderCurrency || catalogItem?.currency,
        saleOrderItemId: child.id?.startsWith("local_") ? undefined : child.id,
        backorderQty: Number(child.metadata?.backorder_quantity) || 0,
      }
    })
    const lineKey = oi.metadata?.client_line_key || oi.id || uuidv4()
    return {
      ...(catalogItem as CatalogItem),
      id: oi.catalog_item_id,
      name: oi.name || catalogItem?.name,
      cartQty: hostQty,
      cartPrice: Number(oi.unit_price) || 0,
      saleOrderItemId: oi.id?.startsWith("local_") ? undefined : oi.id,
      // Persisted line prices are already expressed in the order currency.
      currency: localCheckoutSnapshot ? oi.metadata?.local_currency : orderCurrency || catalogItem?.currency,
      ...(localCheckoutSnapshot ? {
        reservationStart: oi.metadata?.reservation_start,
        reservationEnd: oi.metadata?.reservation_end,
      } : {}),
      backorderQty: Number(oi.metadata?.backorder_quantity) || 0,
      lineKey,
      modifiers,
    } as PosCartItem
  })
}
