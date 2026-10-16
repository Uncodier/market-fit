import type { SupabaseClient } from "@supabase/supabase-js"
import type { CheckoutLine } from "./checkout-types"
import { resolveSiteCurrency } from "./checkout-currency"

type PersistedLine = {
  id: string
  catalog_item_id: string | null
  parent_sale_order_item_id: string | null
}

/** References locate server-owned currency; client currency codes are never used. */
export async function resolveExistingCheckoutCurrency(params: {
  supabase: SupabaseClient
  siteId: string
  lines: CheckoutLine[]
  isStaffCheckout: boolean
  priceListChannel: unknown
  effectiveExistingOrderId?: string
}) {
  const referenced = params.lines.some((line) => line.saleOrderItemId ||
    line.modifiers?.some((modifier) => modifier.saleOrderItemId))
  const isExistingPos = params.isStaffCheckout && params.priceListChannel === "pos" &&
    !!params.effectiveExistingOrderId
  if (!isExistingPos) {
    if (referenced) throw new Error("Stored line prices require an existing POS order.")
    return undefined
  }

  // Always use the user-scoped client: a reference cannot grant cross-site access.
  const { data, error } = await params.supabase.from("sale_orders")
    .select("currency, sale_order_items(id, catalog_item_id, parent_sale_order_item_id)")
    .eq("site_id", params.siteId).eq("id", params.effectiveExistingOrderId!).single()
  if (error || !data || typeof data.currency !== "string" || !data.currency.trim()) {
    throw new Error("Unable to verify the existing order currency.")
  }
  const currency = resolveSiteCurrency(data.currency)
  const rows = new Map((data.sale_order_items as PersistedLine[] || []).map((row) => [row.id, row]))
  for (const line of params.lines) {
    if (line.saleOrderItemId) {
      const row = rows.get(line.saleOrderItemId)
      if (!row || row.catalog_item_id !== line.catalogItemId || row.parent_sale_order_item_id) {
        throw new Error("Stored price does not belong to this order line.")
      }
    }
    for (const modifier of line.modifiers || []) {
      if (!modifier.saleOrderItemId) continue
      const row = rows.get(modifier.saleOrderItemId)
      if (!line.saleOrderItemId || !row || row.catalog_item_id !== modifier.catalogItemId ||
        row.parent_sale_order_item_id !== line.saleOrderItemId) {
        throw new Error("Stored modifier price does not belong to this order line.")
      }
    }
  }
  return { currency }
}