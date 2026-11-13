import "server-only"

import { NextResponse } from "next/server"
import { z } from "zod"
import { batchSchema } from "@/app/inventory/movements/schema"
import { executeInventoryBatch, InventoryOperationError } from "@/app/inventory/movements/operations"
import { userCanOnLocation } from "@/lib/permissions/location-access"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"
import type { requireSiteAccess } from "@/lib/auth/api-site-access"

export { billInventoryReceiptSchema as receiveBillSchema } from "@/app/bills/receipt-schema"

export function inventoryReply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } })
}

export async function parseInventoryRequest<T>(request: Request, schema: z.ZodType<T>, maxBytes: number) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return { error: inventoryReply({ error: "Content-Type must be application/json" }, 415) } as const
  }
  try {
    const value = JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, maxBytes)))
    const result = schema.safeParse(value)
    if (!result.success) return { error: inventoryReply({ error: "Invalid inventory request" }, 400) } as const
    return { input: result.data } as const
  } catch (error) {
    return { error: inventoryReply({ error: error instanceof RequestBodyTooLargeError ? "Request body is too large" : "Invalid JSON request" },
      error instanceof RequestBodyTooLargeError ? 413 : 400) } as const
  }
}

type UserClient = Extract<Awaited<ReturnType<typeof requireSiteAccess>>, { supabase: unknown }>["supabase"]

export async function runAuthorizedInventoryBatch(client: UserClient, input: z.infer<typeof batchSchema>) {
  try {
    // Authorize every endpoint before executing the one atomic RPC; never loop over mutations.
    const locationIds = new Set<string>()
    for (const operation of input.operations) {
      locationIds.add(operation.toLocationId)
      if (operation.kind === "transfer") locationIds.add(operation.fromLocationId)
      if (operation.kind === "receipt") {
        const { data: purchase, error } = await client.from("purchases").select("id, location_id")
          .eq("site_id", input.siteId).eq("id", operation.purchaseId).maybeSingle()
        if (error || !purchase) return inventoryReply({ error: "Bill is unavailable or not authorized" }, 403)
        // A destination grant cannot grant access to a bill at a different location.
        if (!await userCanOnLocation(client, input.siteId, purchase.location_id, "update")) {
          return inventoryReply({ error: "Forbidden" }, 403)
        }
      }
    }
    for (const id of locationIds) {
      if (!await userCanOnLocation(client, input.siteId, id, "update")) return inventoryReply({ error: "Forbidden" }, 403)
    }
    return inventoryReply(await executeInventoryBatch(client, input))
  } catch (error) {
    if (error instanceof InventoryOperationError) return inventoryReply({ error: error.message }, error.status)
    return inventoryReply({ error: "Inventory operation could not be confirmed" }, 503)
  }
}