import "server-only"
import { z } from "zod"
import { batchSchema } from "./schema"
import type { createClient } from "@/lib/supabase/server"

export class InventoryOperationError extends Error {
  constructor(message: string, public status: 400 | 403 | 409 | 503, public code?: "request_conflict" | "operation_rejected") { super(message) }
}
const resultSchema = z.object({
  success: z.literal(true), requestId: z.string().uuid(),
  movementIds: z.array(z.string().uuid()), alreadyApplied: z.boolean(),
})

export async function executeInventoryBatch(client: Awaited<ReturnType<typeof createClient>>, input: unknown) {
  const parsed = batchSchema.safeParse(input)
  if (!parsed.success) throw new InventoryOperationError("Invalid inventory operations", 400)
  if (client._isDemo) throw new InventoryOperationError("Demo inventory is read-only", 403)
  const { data, error } = await client.rpc("apply_inventory_operations", {
    p_site_id: parsed.data.siteId, p_request_id: parsed.data.requestId, p_operations: parsed.data.operations,
  })
  if (error) {
    if (error.code === "42501") throw new InventoryOperationError("Inventory access denied", 403)
    if (["22023", "22P02", "23503"].includes(error.code)) throw new InventoryOperationError("Invalid inventory, bill, quantity or location", 400)
    if (error.code === "23505") throw new InventoryOperationError("Request ID was already used with different operations", 409, "request_conflict")
    if (error.code === "P0001") throw new InventoryOperationError("Insufficient inventory or bill cannot be received", 409, "operation_rejected")
    throw new InventoryOperationError("Inventory operations could not be confirmed. Retry with the same request ID; the inventory movements migration may be required.", 503)
  }
  const result = resultSchema.safeParse(data)
  if (!result.success || result.data.requestId !== parsed.data.requestId) {
    throw new InventoryOperationError("Inventory result could not be confirmed. Retry with the same request ID.", 503)
  }
  return result.data
}