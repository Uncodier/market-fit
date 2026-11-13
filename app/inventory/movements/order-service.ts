import "server-only"
import { z } from "zod"
import type { createClient } from "@/lib/supabase/server"
import { InventoryOperationError } from "./operations"
import { transferOrderSchema, transferTransitionSchema } from "./order-schema"

const resultSchema = z.object({ success: z.literal(true), orderId: z.string().uuid(), requestId: z.string().uuid(), alreadyApplied: z.boolean() })
export async function executeTransferOrder(client: Awaited<ReturnType<typeof createClient>>, input: unknown, transition = false) {
  const parsed = transition ? transferTransitionSchema.safeParse(input) : transferOrderSchema.safeParse(input)
  if (!parsed.success) throw new InventoryOperationError("Invalid transfer order request", 400)
  if (client._isDemo) throw new InventoryOperationError("Demo transfers are read-only", 403)
  const { siteId, requestId, ...payload } = parsed.data
  const orderId = "orderId" in payload ? payload.orderId : undefined
  const body = { ...payload } as Record<string, unknown>
  delete body.orderId
  const { data, error } = await client.rpc(transition ? "transition_inventory_transfer_order" : "create_inventory_transfer_order", {
    p_site_id: siteId, p_request_id: requestId, p_input: body, ...(transition ? { p_order_id: orderId } : {}),
  })
  if (error) {
    if (error.code === "42501") throw new InventoryOperationError("Transfer order access denied", 403)
    if (["22023", "22P02", "23503"].includes(error.code)) throw new InventoryOperationError("Invalid transfer items, quantities or responsibility", 400)
    if (error.code === "23505") throw new InventoryOperationError("Request ID conflict; retain the original transfer request", 409, "request_conflict")
    if (["P0001", "40001"].includes(error.code)) throw new InventoryOperationError("Transfer state, revision or available inventory has changed", 409, "operation_rejected")
    throw new InventoryOperationError("Transfer result could not be confirmed. Retry the identical request ID; transfer migrations may be required.", 503)
  }
  const result = resultSchema.safeParse(data)
  if (!result.success || result.data.requestId !== requestId || (transition && result.data.orderId !== orderId)) {
    throw new InventoryOperationError("Transfer result could not be confirmed. Retain the request ID.", 503)
  }
  return result.data
}