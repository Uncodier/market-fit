"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { executeInventoryBatch, InventoryOperationError } from "./operations"
import { createMovementSchema } from "./schema"
import type { InventoryMovement } from "./types"

export async function listInventoryMovements(siteId: string): Promise<{ data: InventoryMovement[]; error?: string }> {
  try {
    if (!z.string().uuid().safeParse(siteId).success) throw new Error()
    const client = await createClient(true)
    const { data: { user }, error: authError } = await client.auth.getUser()
    if (authError || !user || !await userCanOnSite(client, siteId, "select")) throw new Error()
    const [ledger, transferEvents] = await Promise.all([
      client.from("inventory_movements")
        .select("id,created_at,catalog_item_id,item_name,from_location_id,to_location_id,from_location_name,to_location_name,quantity,kind,notes,purchase_id,receiving_user_id,receiving_user_name,transfer_order_id")
        .eq("site_id", siteId).order("created_at", { ascending: false }).limit(1000),
      client.from("inventory_transfer_stock_events").select("id,created_at,order_id,action,catalog_item_id,item_name,location_id,location_name,quantity")
        .eq("site_id", siteId).order("created_at", { ascending: false }).limit(1000),
    ])
    if (ledger.error || transferEvents.error) throw new Error()
    type StockEvent = { id: string; created_at: string; order_id: string; action: "dispatch" | "receive" | "return" | "writeoff";
      catalog_item_id: string; item_name: string; location_id: string | null; location_name: string; quantity: number }
    const events: InventoryMovement[] = (transferEvents.data || []).map((event: StockEvent) => ({
      id: event.id, created_at: event.created_at, catalog_item_id: event.catalog_item_id, item_name: event.item_name,
      from_location_id: null, from_location_name: null, to_location_id: event.location_id || "", to_location_name: event.location_name,
      quantity: Number(event.quantity), kind: event.action, notes: null, purchase_id: null, transfer_order_id: event.order_id,
    }))
    const data = [...(ledger.data || []).map((row: InventoryMovement) => ({ ...row, quantity: Number(row.quantity) })), ...events]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 1000)
    return { data }
  } catch {
    return { data: [], error: "Unable to load inventory movements. Check access and the inventory movements migration." }
  }
}

export async function createInventoryMovement(input: z.infer<typeof createMovementSchema>) {
  try {
    const parsed = createMovementSchema.safeParse(input)
    if (!parsed.success) return { error: "Invalid inventory movement", status: 400 }
    const client = await createClient(true)
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user) return { error: "Not authenticated", status: 403 }
    const { siteId, requestId, ...movement } = parsed.data
    const operations = "items" in movement
      ? movement.items.map(item => ({ kind: "transfer" as const, ...item, fromLocationId: movement.fromLocationId,
        toLocationId: movement.toLocationId, notes: movement.notes, receivingUserId: movement.receivingUserId }))
      : [{ ...movement, kind: "transfer" as const }]
    const result = await executeInventoryBatch(client, { siteId, requestId, operations })
    revalidatePath("/inventory")
    revalidatePath("/inventory/movements")
    return result
  } catch (error) {
    return { error: error instanceof InventoryOperationError ? error.message : "Inventory movement could not be confirmed",
      status: error instanceof InventoryOperationError ? error.status : 503,
      code: error instanceof InventoryOperationError ? error.code : undefined }
  }
}