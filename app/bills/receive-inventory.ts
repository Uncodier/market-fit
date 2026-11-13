import "server-only"
import { z } from "zod"
import type { createClient } from "@/lib/supabase/server"
import { userCanOnLocation } from "@/lib/permissions/location-access"
import { InventoryOperationError } from "@/app/inventory/movements/operations"
import { billInventoryReceiptSchema } from "./receipt-schema"

const resultSchema = z.object({
  success: z.literal(true), requestId: z.string().uuid(),
  movementIds: z.array(z.string().uuid()), alreadyApplied: z.boolean(),
})

/** Both the action and HTTP route use the caller's RLS-scoped client. */
export async function executeBillInventoryReceipt(client: Awaited<ReturnType<typeof createClient>>, input: unknown) {
  const parsed = billInventoryReceiptSchema.safeParse(input)
  if (!parsed.success) throw new InventoryOperationError("Invalid bill receipt", 400)
  if (client._isDemo) throw new InventoryOperationError("Demo inventory is read-only", 403)
  const { siteId, purchaseId, requestId, toLocationId, receivingUserId, lines } = parsed.data
  const { data: purchase, error: readError } = await client.from("purchases").select("id, location_id")
    .eq("site_id", siteId).eq("id", purchaseId).maybeSingle()
  if (readError || !purchase) throw new InventoryOperationError("Bill is unavailable or not authorized", 403)
  if (!await userCanOnLocation(client, siteId, purchase.location_id, "update") ||
      !await userCanOnLocation(client, siteId, toLocationId, "update")) {
    throw new InventoryOperationError("Forbidden", 403)
  }
  // The transaction validates the receiver, bill-line ownership and locked remaining quantities.
  const { data, error } = await client.rpc("receive_bill_inventory_lines", {
    p_site_id: siteId, p_purchase_id: purchaseId, p_request_id: requestId,
    p_location_id: toLocationId, p_receiving_user_id: receivingUserId, p_lines: lines,
  })
  if (error) {
    if (error.code === "42501") throw new InventoryOperationError("Inventory access denied", 403)
    if (["22023", "22P02", "23503"].includes(error.code)) throw new InventoryOperationError("Invalid bill line, quantity, location or receiver", 400)
    if (error.code === "23505") throw new InventoryOperationError("Request ID was already used with different input", 409, "request_conflict")
    if (error.code === "P0001") throw new InventoryOperationError("Bill cannot be received or quantity exceeds remaining", 409, "operation_rejected")
    throw new InventoryOperationError("Bill receipt could not be confirmed. Retry with the same request ID.", 503)
  }
  const result = resultSchema.safeParse(data)
  if (!result.success || result.data.requestId !== requestId) {
    throw new InventoryOperationError("Bill receipt could not be confirmed. Retry with the same request ID.", 503)
  }
  return result.data
}