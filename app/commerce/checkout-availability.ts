import { assertCanSell } from "@/app/catalog/sell-availability"
import { shouldSkipVariantSelectionForCheckoutLine } from "@/app/catalog/product-details"
import type { CheckoutLine, ProcessedCheckoutLine } from "./checkout-types"

type StockRequest = {
  catalogItemId: string
  quantity: number
  skipVariantSelection: boolean
}

type CheckoutStock = Map<string, number | undefined> | null

function assertPositiveQuantity(quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive finite number")
  }
}

/** Read backend stock and policy; POS demand includes each modifier per host unit. */
export async function revalidateCheckoutAvailability(params: {
  siteId: string
  lines: CheckoutLine[]
  originLocationId?: string
  isAdmin: boolean
  priceListChannel: unknown
  existingReservationId?: string
}): Promise<CheckoutStock> {
  const requests: StockRequest[] = []
  for (const line of params.lines) {
    assertPositiveQuantity(line.quantity)
    requests.push({
      catalogItemId: line.catalogItemId,
      quantity: line.quantity,
      skipVariantSelection: shouldSkipVariantSelectionForCheckoutLine({
        existingReservationId: params.existingReservationId,
        reservationStart: line.reservationStart,
      }),
    })
    for (const modifier of line.modifiers || []) {
      assertPositiveQuantity(modifier.quantity)
      const quantity = modifier.quantity * line.quantity
      assertPositiveQuantity(quantity)
      if (!modifier.catalogItemId) throw new Error("Modifier item is required")
      requests.push({ catalogItemId: modifier.catalogItemId, quantity, skipVariantSelection: true })
    }
  }

  const isPos = params.priceListChannel === "pos"
  const totals = new Map<string, StockRequest>()
  if (isPos) {
    for (const request of requests) {
      const prior = totals.get(request.catalogItemId)
      const quantity = (prior?.quantity || 0) + request.quantity
      assertPositiveQuantity(quantity)
      totals.set(request.catalogItemId, {
        ...request,
        quantity,
        // A modifier must not bypass a host line's variant guard for the same SKU.
        skipVariantSelection: request.skipVariantSelection && (prior?.skipVariantSelection ?? true),
      })
    }
  }

  const stock: CheckoutStock = isPos ? new Map() : null
  for (const request of isPos ? totals.values() : requests) {
    const availability = await assertCanSell(
      params.siteId,
      request.catalogItemId,
      request.quantity,
      params.originLocationId,
      params.isAdmin,
      { skipVariantSelection: request.skipVariantSelection },
    )
    stock?.set(request.catalogItemId, availability.availableQty)
  }
  return stock
}

/** A shortage snapshot, not a reservation or fulfillment lifecycle transition. */
export function allocateCheckoutBackorders(
  lines: ProcessedCheckoutLine[],
  stock: CheckoutStock,
): ProcessedCheckoutLine[] {
  if (!stock) return lines
  const remaining = new Map(stock)
  return lines.map((line) => {
    const available = remaining.get(line.catalog_item_id)
    const covered = available === undefined
      ? line.quantity
      : Math.min(line.quantity, Math.max(0, available))
    if (available !== undefined) {
      remaining.set(line.catalog_item_id, Math.max(0, available - covered))
    }
    return { ...line, backorder_quantity: line.quantity - covered }
  })
}