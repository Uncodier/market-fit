import { requireInventoryApiAccess } from "../auth"
import { inventoryReply, parseInventoryRequest, receiveBillSchema } from "../request"
import { executeBillInventoryReceipt } from "@/app/bills/receive-inventory"
import { InventoryOperationError } from "@/app/inventory/movements/operations"

export async function POST(request: Request) {
  const parsed = await parseInventoryRequest(request, receiveBillSchema, 131_072)
  if (parsed.error) return parsed.error
  try {
    const access = await requireInventoryApiAccess(request, parsed.input.siteId)
    if (access.error) return access.error
    return inventoryReply(await executeBillInventoryReceipt(access.supabase, parsed.input))
  } catch (error) {
    if (error instanceof InventoryOperationError) return inventoryReply({ error: error.message }, error.status)
    return inventoryReply({ error: "Bill receipt could not be confirmed. Retry with the same request ID." }, 503)
  }
}