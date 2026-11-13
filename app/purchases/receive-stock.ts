import "server-only"
import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { executeInventoryBatch } from "@/app/inventory/movements/operations"
import { requirePurchaseAccess, validatePurchaseId } from "./purchase-access"
import { getPurchaseById } from "./purchase-queries"

export async function receivePurchaseStock(siteId: string, purchaseId: string, locationId?: string | null) {
  try {
    const { supabase } = await requirePurchaseAccess(siteId, "update", purchaseId)
    if (locationId != null) validatePurchaseId(locationId, "location")
    const { purchase, error } = await getPurchaseById(siteId, purchaseId)
    if (error || !purchase) return { success: false, error: "Bill not found" }
    const destination = locationId || purchase.locationId
    if (!destination) return { success: false, error: "Location is required to receive stock" }
    // The locked bill's received flag also deduplicates separate requests or actors.
    // Product lines, stock and that flag commit together in the database.
    const result = await executeInventoryBatch(supabase, {
      siteId, requestId: randomUUID(),
      operations: [{ kind: "receipt", purchaseId, toLocationId: destination }],
    })
    revalidatePath("/bills")
    revalidatePath(`/bills/${purchaseId}`)
    revalidatePath("/inventory")
    revalidatePath("/inventory/movements")
    return { success: true, error: null, alreadyReceived: result.alreadyApplied || result.movementIds.length === 0 }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to receive stock" }
  }
}