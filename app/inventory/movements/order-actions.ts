"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { InventoryOperationError } from "./operations"
import { executeTransferOrder } from "./order-service"
import type { CreateTransferOrderInput, TransferTransitionInput } from "./order-schema"
import type { TransferOrder, TransferOrderDetail, TransferLine } from "./order-types"

const orderFields = "id,site_id,status,from_location_id,to_location_id,from_location_name,to_location_name,requested_by,receiving_user_id,receiving_user_name,notes,revision,created_at,updated_at"
async function readClient(siteId: string) {
  if (!z.string().uuid().safeParse(siteId).success) throw new Error("Invalid site")
  const client = await createClient(true)
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user || !await userCanOnSite(client, siteId, "select")) throw new Error("Access denied")
  return client
}

export async function listTransferOrders(siteId: string): Promise<{ data: TransferOrder[]; error?: string }> {
  try {
    const client = await readClient(siteId)
    const { data, error } = await client.from("inventory_transfer_orders").select(orderFields)
      .eq("site_id", siteId).order("created_at", { ascending: false }).limit(1000)
    if (error) throw new Error()
    return { data: data || [] }
  } catch {
    return { data: [], error: "Unable to load transfer orders. Check access and transfer order migrations." }
  }
}

export async function getTransferOrder(siteId: string, orderId: string): Promise<{ data: TransferOrderDetail | null; error?: string }> {
  try {
    if (!z.string().uuid().safeParse(orderId).success) throw new Error()
    const client = await readClient(siteId)
    const { data: order, error } = await client.from("inventory_transfer_orders").select(orderFields)
      .eq("site_id", siteId).eq("id", orderId).maybeSingle()
    if (error || !order) throw new Error()
    const [lines, events] = await Promise.all([
      client.from("inventory_transfer_lines").select("id,site_id,order_id,catalog_item_id,item_name,requested_quantity,dispatched_quantity,received_quantity,returned_quantity,written_off_quantity,discrepancy_notes")
        .eq("site_id", siteId).eq("order_id", orderId).order("id"),
      client.from("inventory_transfer_events").select("id,action,actor_id,created_at,payload")
        .eq("site_id", siteId).eq("order_id", orderId).order("created_at", { ascending: false }),
    ])
    if (lines.error || events.error) throw new Error()
    return { data: { ...order, lines: (lines.data || []).map((line: TransferLine) => ({ ...line,
      requested_quantity: Number(line.requested_quantity), dispatched_quantity: Number(line.dispatched_quantity),
      received_quantity: Number(line.received_quantity), returned_quantity: Number(line.returned_quantity),
      written_off_quantity: Number(line.written_off_quantity) })), events: events.data || [] } }
  } catch {
    return { data: null, error: "Transfer order is unavailable or not authorized." }
  }
}

async function mutate(input: CreateTransferOrderInput | TransferTransitionInput, transition: boolean) {
  try {
    const client = await createClient(true)
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user) return { error: "Not authenticated", status: 403 }
    const result = await executeTransferOrder(client, input, transition)
    revalidatePath("/inventory")
    revalidatePath("/inventory/movements")
    revalidatePath(`/inventory/movements/${result.orderId}`)
    return result
  } catch (error) {
    return { error: error instanceof InventoryOperationError ? error.message : "Transfer request could not be confirmed",
      status: error instanceof InventoryOperationError ? error.status : 503,
      code: error instanceof InventoryOperationError ? error.code : undefined }
  }
}
export async function createTransferOrder(input: CreateTransferOrderInput) { return mutate(input, false) }
export async function transitionTransferOrder(input: TransferTransitionInput) { return mutate(input, true) }