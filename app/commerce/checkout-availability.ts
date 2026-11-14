import { assertCanSell } from "@/app/catalog/sell-availability"
import { shouldSkipVariantSelectionForCheckoutLine } from "@/app/catalog/product-details"
import type { CheckoutLine, ProcessedCheckoutLine } from "./checkout-types"
import { loadCheckoutCompletedQuantities } from "./checkout-completed-quantities"

type StockRequest = {
  catalogItemId: string
  quantity: number
  skipVariantSelection: boolean
  completedWithoutStock?: boolean
}

type CheckoutStock = (Map<string, number | undefined> & { completedQuantities?: number[] }) | null

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
  selfServiceLocationId?: string
  publicCheckout?: boolean
  supabaseAdmin?: import("./checkout-types").CheckoutSupabaseClient
  supabase?: import("./checkout-types").CheckoutSupabaseClient
  isStaffCheckout?: boolean
  effectiveExistingOrderId?: string
  intent?: string
}): Promise<CheckoutStock> {
  const requests: StockRequest[] = []
  for (const line of params.lines) {
    assertPositiveQuantity(line.quantity)
    requests.push({
      catalogItemId: line.catalogItemId,
      quantity: line.quantity,
      completedWithoutStock: line.completedWithoutStock,
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
      requests.push({ catalogItemId: modifier.catalogItemId, quantity, skipVariantSelection: true,
        completedWithoutStock: line.completedWithoutStock })
    }
  }

  const isPos = params.priceListChannel === "pos"
  const completedQuantities = await loadCheckoutCompletedQuantities(params)
  const pendingRequests: StockRequest[] = []
  for (const [index, request] of requests.entries()) {
    const completed = completedQuantities[index] || 0
    if (request.completedWithoutStock || completed === request.quantity) {
      if (!isPos || !params.isStaffCheckout) throw new Error("Completed lines require POS access.")
      // The option separately authorizes POS access and retains catalog/variant guards.
      await assertCanSell(params.siteId, request.catalogItemId, request.quantity,
        params.originLocationId, params.isAdmin,
        { skipVariantSelection: request.skipVariantSelection,
          ...(completed === request.quantity ? { inventoryAlreadyCompleted: true } : { completedWithoutStock: true }) })
    } else {
      pendingRequests.push({ ...request, quantity: request.quantity - completed })
    }
  }
  const totals = new Map<string, StockRequest>()
  if (isPos || params.selfServiceLocationId || params.publicCheckout) {
    for (const request of pendingRequests) {
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
  if (stock) stock.completedQuantities = completedQuantities
  for (const request of isPos || params.selfServiceLocationId || params.publicCheckout ? totals.values() : pendingRequests) {
    const availability = await assertCanSell(
      params.siteId,
      request.catalogItemId,
      request.quantity,
      params.originLocationId,
      params.isAdmin,
      { skipVariantSelection: request.skipVariantSelection,
        ...(params.selfServiceLocationId || params.publicCheckout ? { checkoutClient: params.supabaseAdmin } : {}) },
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
  return lines.map((line, index) => {
    const completed = Math.min(line.quantity, stock.completedQuantities?.[index] || 0)
    if (line.completed_without_stock) return { ...line, backorder_quantity: 0 }
    const demand = line.quantity - completed
    const available = remaining.get(line.catalog_item_id)
    const covered = available === undefined
      ? demand
      : Math.min(demand, Math.max(0, available))
    if (available !== undefined) {
      remaining.set(line.catalog_item_id, Math.max(0, available - covered))
    }
    return { ...line, backorder_quantity: demand - covered,
      ...(completed > 0 ? { inventory_completed_quantity: completed } : {}) }
  })
}