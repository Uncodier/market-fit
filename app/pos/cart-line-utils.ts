import { v4 as uuidv4 } from "uuid"
import type { CatalogItem } from "@/app/types"
import { buildModifierSignature } from "@/app/catalog/modifier-validate"
import { needsBuyerAccount } from "@/app/catalog/product-details"
import {
  applyLineDiscountFields,
  clearLineDiscountFields,
} from "@/app/pos/line-discount"
import type { PosCartItem, PosCartModifier } from "@/app/pos/components/CartPanel"

export function cartLineKey(item: PosCartItem): string {
  return item.lineKey || item.id
}

function mapCartLine(
  cart: PosCartItem[],
  id: string,
  update: (item: PosCartItem) => PosCartItem,
): PosCartItem[] {
  return cart.map((c) => (cartLineKey(c) === id ? update(c) : c))
}

export function cartWithQtyDelta(
  cart: PosCartItem[],
  id: string,
  delta: number,
): PosCartItem[] {
  return mapCartLine(cart, id, (c) => ({
    ...c,
    cartQty: Math.max(0, c.cartQty + delta),
  })).filter((c) => c.cartQty > 0)
}

export function cartWithQty(
  cart: PosCartItem[],
  id: string,
  qty: number,
): PosCartItem[] {
  return mapCartLine(cart, id, (c) => ({
    ...c,
    cartQty: Math.max(0, qty),
  }))
}

export function cartWithPrice(
  cart: PosCartItem[],
  id: string,
  price: number,
): PosCartItem[] {
  return mapCartLine(cart, id, (c) => clearLineDiscountFields(c, price))
}

export function cartWithDiscountPercent(
  cart: PosCartItem[],
  id: string,
  percent: number,
): PosCartItem[] {
  return mapCartLine(cart, id, (c) => applyLineDiscountFields(c, percent))
}

/** Merge identical host+modifiers into one line, or append a new cart line. */
export function mergeItemIntoCart(
  prev: PosCartItem[],
  item: CatalogItem,
  extras: Partial<PosCartItem> | undefined,
  resolvePrice: (item: CatalogItem) => number,
): { next: PosCartItem[]; lineKey: string } {
  const modifiers = extras?.modifiers || []
  const signature = buildModifierSignature(
    item.id,
    modifiers.map((m) => ({
      catalogItemId: m.catalogItemId,
      quantity: m.cartQty,
    })),
  )
  const reservationKey = `${extras?.reservationStart || ""}|${extras?.reservationEnd || ""}`
  const mergeKey = `${signature}|${reservationKey}`
  let nextLineKey = extras?.lineKey || uuidv4()

  const existing = prev.find((c) => {
    const cMods = c.modifiers || []
    const cSig = buildModifierSignature(
      c.id,
      cMods.map((m) => ({
        catalogItemId: m.catalogItemId,
        quantity: m.cartQty,
      })),
    )
    const cRes = `${c.reservationStart || ""}|${c.reservationEnd || ""}`
    return `${cSig}|${cRes}` === mergeKey
  })

  if (existing && !extras?.reservationStart) {
    nextLineKey = existing.lineKey || existing.id
    return {
      lineKey: nextLineKey,
      next: prev.map((c) =>
        cartLineKey(c) === nextLineKey
          ? { ...c, cartQty: c.cartQty + (extras?.cartQty ?? 1) }
          : c,
      ),
    }
  }

  const price = extras?.cartPrice ?? resolvePrice(item)
  return {
    lineKey: nextLineKey,
    next: [
      {
        ...item,
        ...extras,
        cartQty: extras?.cartQty ?? 1,
        cartPrice: price,
        lineKey: nextLineKey,
        modifiers,
      },
      ...prev,
    ],
  }
}

export function modifiersUnitTotal(modifiers?: PosCartModifier[]): number {
  return (modifiers || []).reduce(
    (sum, m) => sum + m.cartPrice * m.cartQty,
    0,
  )
}

export function cartLineUnitTotal(item: PosCartItem): number {
  return item.cartPrice + modifiersUnitTotal(item.modifiers)
}

export function cartLineExtendedTotal(item: PosCartItem): number {
  return cartLineUnitTotal(item) * item.cartQty
}

export function cartHasReservationSlot(
  cart: Pick<PosCartItem, "cartQty" | "reservationStart">[],
): boolean {
  return cart.some((c) => c.cartQty > 0 && Boolean(c.reservationStart))
}

export function cartHasBuyerAccountItem(
  cart: Pick<PosCartItem, "cartQty" | "kind" | "is_recurring">[],
): boolean {
  return cart.some((c) => c.cartQty > 0 && needsBuyerAccount(c))
}
