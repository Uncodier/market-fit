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
    ? mapSaleOrderItemsToDeltaLines(params.nextItems.filter((item) => item.metadata?.completed_without_stock !== true))
    : (params.processedLines || []).filter((line) => line.completed_without_stock !== true).map(mapProcessedLineToDeltaLine)
  const delta = computeKitchenDelta(
    mapSaleOrderItemsToDeltaLines((params.existingItems || []).filter((item) => item.metadata?.completed_without_stock !== true)),
    next,
  )
  return kitchenDeltaHasWork(delta) ? delta : { kind: "none", adds: [], qtyChanges: [], voids: [] }
}
