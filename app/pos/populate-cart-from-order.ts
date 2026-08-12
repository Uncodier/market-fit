import { v4 as uuidv4 } from "uuid"
import type { CatalogItem } from "@/app/types"
import type { PosCartItem } from "@/app/pos/components/CartPanel"

/** Rebuild POS cart lines from sale_order_items, nesting modifiers under hosts. */
export function buildCartFromSaleOrderItems(
  saleOrderItems: any[],
  catalogItems: CatalogItem[],
): PosCartItem[] {
  const rows = saleOrderItems || []
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
    const catalogItem = catalogItems.find((c) => c.id === oi.catalog_item_id)
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
      }
    })
    const lineKey = oi.metadata?.client_line_key || oi.id || uuidv4()
    return {
      ...(catalogItem as CatalogItem),
      id: oi.catalog_item_id,
      name: oi.name || catalogItem?.name,
      cartQty: hostQty,
      cartPrice: oi.unit_price,
      lineKey,
      modifiers,
    } as PosCartItem
  })
}
