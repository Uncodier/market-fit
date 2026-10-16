import type { CatalogItem } from "@/app/types"

export interface PosCartModifier {
  groupId: string
  catalogItemId: string
  name: string
  cartQty: number
  cartPrice: number
  currency?: string | null
  /** Reference to the persisted modifier whose price is in the order currency. */
  saleOrderItemId?: string
  backorderQty?: number
}

export interface PosCartItem extends CatalogItem {
  cartQty: number
  cartPrice: number
  /** Reference to the persisted host whose price is in the order currency. */
  saleOrderItemId?: string
  /** Unit price before a cashier line discount. */
  cartListPrice?: number
  /** Percent off cartListPrice (0–100). */
  cartDiscountPercent?: number
  /** Stable cart line identity (host + modifiers). */
  lineKey?: string
  modifiers?: PosCartModifier[]
  reservationStart?: string
  reservationEnd?: string
  reservationAvailableQty?: number
  backorderQty?: number
  inventoryMessage?: string
  inventoryCanIncrease?: boolean
}