"use server"

import { revalidatePath } from "next/cache"
import { requirePurchaseAccess } from "@/app/purchases/purchase-access"
import { userCanOnLocation } from "@/lib/permissions/location-access"
import { InventoryOperationError } from "@/app/inventory/movements/operations"
import { executeBillInventoryReceipt } from "./receive-inventory"
import { billInventoryReceiptSchema, type BillInventoryReceiptInput, type BillInventoryReceiptLine } from "./receipt-schema"

type CatalogRelation = { kind: string; name: string }
type BillLineRow = {
  id: string; name: string | null; quantity: number | string; received_quantity: number | string | null
  catalog_item_id: string | null; catalog_items: CatalogRelation | CatalogRelation[] | null
}

export async function readBillInventoryReceiptLines(siteId: string, purchaseId: string) {
  try {
    const { supabase, user } = await requirePurchaseAccess(siteId, "select", purchaseId)
    const { data: bill, error } = await supabase.from("purchases")
      .select("id, location_id, purchase_items(id, name, quantity, received_quantity, catalog_item_id, catalog_items(kind, name))")
      .eq("site_id", siteId).eq("id", purchaseId).maybeSingle()
    if (error || !bill || !await userCanOnLocation(supabase, siteId, bill.location_id, "select")) {
      return { data: [] as BillInventoryReceiptLine[], error: "Bill is unavailable or not authorized" }
    }
    const data: BillInventoryReceiptLine[] = (bill.purchase_items || []).flatMap((line: BillLineRow) => {
      const catalog = Array.isArray(line.catalog_items) ? line.catalog_items[0] : line.catalog_items
      if (catalog?.kind !== "product" || !line.catalog_item_id || !(Number(line.quantity) > 0) ||
        !Number.isFinite(Number(line.quantity)) || !Number.isFinite(Number(line.received_quantity || 0))) return []
      return [{ id: line.id, name: line.name || catalog.name, quantity: Number(line.quantity),
        received_quantity: Number(line.received_quantity || 0), catalog_item_id: line.catalog_item_id }]
    })
    return { data, actorId: user.id, error: null }
  } catch {
    return { data: [] as BillInventoryReceiptLine[], error: "Bill receipt lines could not be loaded" }
  }
}

export async function receiveBillInventoryLines(input: BillInventoryReceiptInput) {
  const parsed = billInventoryReceiptSchema.safeParse(input)
  if (!parsed.success) return { success: false as const, error: "Invalid bill receipt", status: 400 }
  try {
    const { supabase } = await requirePurchaseAccess(parsed.data.siteId, "update", parsed.data.purchaseId)
    const result = await executeBillInventoryReceipt(supabase, parsed.data)
    for (const path of ["/bills", `/bills/${parsed.data.purchaseId}`, "/inventory", "/inventory/movements"]) revalidatePath(path)
    return { ...result, error: null }
  } catch (error) {
    return { success: false as const,
      error: error instanceof InventoryOperationError ? error.message : "Bill receipt could not be confirmed. Retry with the same request ID.",
      status: error instanceof InventoryOperationError ? error.status : 503,
      code: error instanceof InventoryOperationError ? error.code : undefined }
  }
}