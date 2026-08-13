import { roundMoney } from "@/app/commerce/taxes"

export type LineDiscountable = {
  cartPrice: number
  cartListPrice?: number
  cartDiscountPercent?: number
}

/** Unit price before a cashier line discount. */
export function lineListPrice(item: LineDiscountable): number {
  const listed = Number(item.cartListPrice)
  if (item.cartListPrice != null && Number.isFinite(listed) && listed >= 0) {
    return listed
  }
  return Math.max(0, Number(item.cartPrice) || 0)
}

export function clampDiscountPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0
  return Math.min(100, Math.max(0, roundMoney(percent)))
}

export function discountedUnitPrice(listPrice: number, percent: number): number {
  const pct = clampDiscountPercent(percent)
  return roundMoney(Math.max(0, listPrice) * (1 - pct / 100))
}

export function applyLineDiscountFields<T extends LineDiscountable>(
  item: T,
  percent: number,
): T {
  const list = lineListPrice(item)
  const pct = clampDiscountPercent(percent)
  return {
    ...item,
    cartListPrice: list,
    cartDiscountPercent: pct,
    cartPrice: discountedUnitPrice(list, pct),
  }
}

export function clearLineDiscountFields<T extends LineDiscountable>(
  item: T,
  price: number,
): T {
  const next = Math.max(0, Number.isFinite(price) ? price : 0)
  return {
    ...item,
    cartPrice: next,
    cartListPrice: next,
    cartDiscountPercent: 0,
  }
}
