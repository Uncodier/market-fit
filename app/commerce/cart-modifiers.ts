/** Shared cart modifier shape for shop, marketplace, and POS. */

export type CartModifier = {
  groupId: string
  catalogItemId: string
  name: string
  cartQty: number
  cartPrice: number
}

export function modifiersUnitTotal(modifiers?: CartModifier[]): number {
  return (modifiers || []).reduce(
    (sum, m) => sum + Number(m.cartPrice || 0) * Number(m.cartQty || 0),
    0,
  )
}

export function cartLineUnitTotal(item: {
  cartPrice?: number | null
  modifiers?: CartModifier[]
}): number {
  return Number(item.cartPrice || 0) + modifiersUnitTotal(item.modifiers)
}

export function cartLineExtendedTotal(item: {
  cartPrice?: number | null
  cartQty?: number | null
  modifiers?: CartModifier[]
}): number {
  return cartLineUnitTotal(item) * Number(item.cartQty || 0)
}

export function cartLineKey(item: { lineKey?: string; id: string }): string {
  return item.lineKey || item.id
}

export function modifiersSignature(
  hostId: string,
  modifiers?: CartModifier[],
): string {
  const parts = [...(modifiers || [])]
    .map((m) => `${m.groupId}:${m.catalogItemId}:${m.cartQty}`)
    .sort()
  return `${hostId}|${parts.join(",")}`
}

export function toCheckoutModifiers(modifiers?: CartModifier[]) {
  return (modifiers || []).map((m) => ({
    catalogItemId: m.catalogItemId,
    quantity: m.cartQty,
    unitPriceOverride: m.cartPrice,
    groupId: m.groupId,
  }))
}
