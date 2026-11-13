import { requireInventoryApiAccess } from "../auth"
import { inventoryReply, parseInventoryRequest } from "../request"
import { transferOrderSchema, transferTransitionSchema } from "@/app/inventory/movements/order-schema"
import { executeTransferOrder } from "@/app/inventory/movements/order-service"
import { InventoryOperationError } from "@/app/inventory/movements/operations"
import { z } from "zod"

const schema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("create"), input: transferOrderSchema }).strict(),
  z.object({ operation: z.literal("transition"), input: transferTransitionSchema }).strict(),
])
export async function POST(request: Request) {
  const parsed = await parseInventoryRequest(request, schema, 131_072)
  if (parsed.error) return parsed.error
  try {
    const access = await requireInventoryApiAccess(request, parsed.input.input.siteId)
    if (access.error) return access.error
    // Resource and transition authorization is rechecked by the user-scoped RPC
    // after the site's license lock, including manager approval and receiver identity.
    return inventoryReply(await executeTransferOrder(access.supabase, parsed.input.input, parsed.input.operation === "transition"))
  } catch (error) {
    if (error instanceof InventoryOperationError) return inventoryReply({ error: error.message, code: error.code }, error.status)
    return inventoryReply({ error: "Transfer request could not be confirmed" }, 503)
  }
}