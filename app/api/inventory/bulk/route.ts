import { requireInventoryApiAccess } from "../auth"
import { batchSchema } from "@/app/inventory/movements/schema"
import { inventoryReply, parseInventoryRequest, runAuthorizedInventoryBatch } from "../request"

export async function POST(request: Request) {
  const parsed = await parseInventoryRequest(request, batchSchema, 131_072)
  if (parsed.error) return parsed.error
  try {
    const access = await requireInventoryApiAccess(request, parsed.input.siteId)
    if (access.error) return access.error
    return await runAuthorizedInventoryBatch(access.supabase, parsed.input)
  } catch {
    return inventoryReply({ error: "Inventory authorization could not be verified" }, 503)
  }
}