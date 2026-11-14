import type { CheckoutLine, CheckoutSupabaseClient } from "./checkout-types"

type PersistedLine = {
  id: string
  catalog_item_id: string
  quantity: number | string
  status: string
  parent_sale_order_item_id: string | null
  metadata?: { client_line_key?: string; modifier_group_id?: string }
  sale_order_item_units?: { quantity: number | string; status: string }[]
}

function completedQuantity(row: PersistedLine): number {
  const quantity = Number(row.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0 || ["cancelled", "returned"].includes(row.status)) return 0
  if (row.status === "completed") return quantity
  const completed = (row.sale_order_item_units || []).reduce((sum, unit) => {
    const value = Number(unit.quantity)
    return sum + (unit.status === "completed" && Number.isFinite(value) && value > 0 ? value : 0)
  }, 0)
  return Math.min(quantity, completed)
}

/** Only persisted fulfillment, never a status or quantity claimed by the browser. */
export async function loadCheckoutCompletedQuantities(params: {
  supabase?: CheckoutSupabaseClient
  siteId: string
  lines: CheckoutLine[]
  isStaffCheckout?: boolean
  priceListChannel: unknown
  intent?: string
  effectiveExistingOrderId?: string
}): Promise<number[]> {
  const empty = params.lines.flatMap((line) => [0, ...(line.modifiers || []).map(() => 0)])
  if (!params.isStaffCheckout || params.priceListChannel !== "pos" || params.intent !== "pay" ||
    !params.effectiveExistingOrderId) return empty
  // RLS and both IDs constrain even an otherwise authorized cashier's references.
  const { data, error } = await params.supabase.from("sale_orders")
    .select("id, sale_order_items(id, catalog_item_id, quantity, status, parent_sale_order_item_id, metadata, sale_order_item_units(quantity, status))")
    .eq("site_id", params.siteId).eq("id", params.effectiveExistingOrderId).single()
  if (error || !data || !Array.isArray(data.sale_order_items)) {
    throw new Error("Unable to verify completed order quantities.")
  }
  const rows = new Map<string, PersistedLine>(data.sale_order_items.map((row: PersistedLine) => [row.id, row]))
  const used = new Set<string>()
  const take = (id: string | undefined, sku: string, quantity: number, parentId: string | null,
    key: string | undefined, group?: string): number => {
    if (!id) return 0
    const row = rows.get(id)
    if (!row || row.catalog_item_id !== sku || (row.parent_sale_order_item_id || null) !== parentId || used.has(id)) {
      throw new Error("Completed quantity does not belong to this order line.")
    }
    used.add(id)
    // Match the identity used by persistence, not merely a reusable SKU reference.
    if (row.metadata?.client_line_key && row.metadata.client_line_key !== key) return 0
    if (parentId && (row.metadata?.modifier_group_id || "") !== (group || "")) return 0
    return Math.min(quantity, completedQuantity(row))
  }
  return params.lines.flatMap((line) => {
    const persistedHost = line.saleOrderItemId ? rows.get(line.saleOrderItemId) : undefined
    // Legacy persistence only matches an unkeyed host when that SKU has no modifiers.
    // Never lend its completed quantities to a newly inserted replacement host.
    const ambiguousLegacyHost = persistedHost && !persistedHost.metadata?.client_line_key && (
      params.lines.some((candidate) => candidate.catalogItemId === line.catalogItemId && candidate.modifiers?.length) ||
      [...rows.values()].filter((row) => !row.parent_sale_order_item_id &&
        row.catalog_item_id === line.catalogItemId && !row.metadata?.client_line_key).length !== 1)
    const replacementHost = persistedHost?.metadata?.client_line_key &&
      persistedHost.metadata.client_line_key !== line.clientLineKey
    if (ambiguousLegacyHost || replacementHost) return [0, ...(line.modifiers || []).map(() => 0)]
    const host = take(line.saleOrderItemId, line.catalogItemId, line.quantity, null, line.clientLineKey)
    return [host, ...(line.modifiers || []).map((modifier) => {
      if (!line.saleOrderItemId) return 0
      return take(modifier.saleOrderItemId, modifier.catalogItemId, modifier.quantity * line.quantity,
        line.saleOrderItemId, `${line.clientLineKey}:mod:${modifier.groupId || "g"}:${modifier.catalogItemId}`, modifier.groupId)
    })]
  })
}