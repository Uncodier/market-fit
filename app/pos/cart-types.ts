import type { CatalogItem } from "@/app/types"

export interface PosCartModifier {
  groupId: string
  catalogItemId: string
  name: string
  cartQty: number
  cartPrice: number
  backorderQty?: number
}

export interface PosCartItem extends CatalogItem {
  cartQty: number
  cartPrice: number
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