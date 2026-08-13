import {
  computeKitchenDelta,
  kitchenDeltaHasWork,
  mapProcessedLineToDeltaLine,
  mapSaleOrderItemsToDeltaLines,
} from "@/lib/printer/core/order-delta"
import type { KitchenDelta } from "@/lib/printer/core/types"

export function kitchenDeltaForSend(params: {
  intent?: string
  existingItems: any[]
  processedLines?: any[]
  nextItems?: any[]
}): KitchenDelta | null {
  if (params.intent !== "send") return null
  const next = params.nextItems
    ? mapSaleOrderItemsToDeltaLines(params.nextItems)
    : (params.processedLines || []).map(mapProcessedLineToDeltaLine)
  const delta = computeKitchenDelta(
    mapSaleOrderItemsToDeltaLines(params.existingItems || []),
    next,
  )
  return kitchenDeltaHasWork(delta) ? delta : { kind: "none", adds: [], qtyChanges: [], voids: [] }
}
