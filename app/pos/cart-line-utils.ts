import { v4 as uuidv4 } from "uuid"
import type { CatalogItem } from "@/app/types"
import { buildModifierSignature } from "@/app/catalog/modifier-validate"
import type { PosCartItem, PosCartModifier } from "@/app/pos/components/CartPanel"

export function cartLineKey(item: PosCartItem): string {
  return item.lineKey || item.id
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
