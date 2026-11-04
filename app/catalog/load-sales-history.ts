import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { readSalesPages, SalesReportLimitError, type SalesClient } from "@/app/api/sales/sales-query"
import { salesCurrency } from "@/lib/sales/report-format"
import type { CatalogSaleRow, CatalogSalesHistory } from "./sales-history-types"

export type CatalogSaleLine = {
  id: string; site_id: string; catalog_item_id: string; name: string
  quantity: number | string; subtotal: number | string | null; status: string
  order: {
    id: string; site_id: string; order_number: string; status: string; currency: string | null
    sale: { id: string; site_id: string; status: string; source: string | null
      sale_date: string | null; created_at: string; currency: string | null }
  } | null
}

// Widen the projection string to avoid recursive PostgREST inference for this nested DTO.
const LINE_FIELDS: string = `id, site_id, catalog_item_id, name, quantity, subtotal, status,
  order:sale_orders!inner(id, site_id, order_number, status, currency,
    sale:sales!inner(id, site_id, status, source, sale_date, created_at, currency))`

type HistoryQuery = ReturnType<ReturnType<SalesClient["from"]>["select"]> & {
  is: (column: string, value: null) => HistoryQuery
}
type HistoryClient = { from: (table: string) => { select: (fields: string) => HistoryQuery } }

export function catalogSaleRows(lines: CatalogSaleLine[], siteId: string, start: string, end: string): CatalogSaleRow[] {
  const rows: CatalogSaleRow[] = []
  for (const line of lines) {
    const order = line.order
    const sale = order?.sale
    if (line.site_id !== siteId || !order || order.site_id !== siteId || !sale || sale.site_id !== siteId) continue
    if (!["completed", "paid"].includes(sale.status) || ["cancelled", "refunded", "draft"].includes(order.status)
      || ["cancelled", "refunded"].includes(line.status)) continue
    const rawDate = sale.sale_date || sale.created_at
    const parsed = new Date(rawDate)
    if (!Number.isFinite(parsed.getTime())) throw new Error("Invalid sale date")
    const date = parsed.toISOString()
    if (date.slice(0, 10) < start || date.slice(0, 10) > end) continue
    const quantity = Number(line.quantity)
    const revenue = Number(line.subtotal)
    if (line.subtotal == null || !Number.isFinite(revenue) || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("Invalid sale line amounts")
    }
    const orderCurrency = salesCurrency(order.currency)
    const saleCurrency = salesCurrency(sale.currency)
    if (orderCurrency !== "UNSPECIFIED" && saleCurrency !== "UNSPECIFIED" && orderCurrency !== saleCurrency) {
      throw new Error("Inconsistent sale currency")
    }
    rows.push({ id: line.id, orderId: order.id, orderNumber: order.order_number, saleId: sale.id,
      date, itemName: line.name, quantity, revenue,
      currency: orderCurrency === "UNSPECIFIED" ? saleCurrency : orderCurrency,
      source: sale.source || "unknown", status: sale.status })
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}

export async function loadCatalogSalesHistory(
  client: SupabaseClient, siteId: string, itemId: string, start: string, end: string,
): Promise<CatalogSalesHistory> {
  // The lightweight query contract avoids recursive generic comparison with the SDK.
  const queries = client as unknown as HistoryClient
  const variants = await readSalesPages<{ id: string }>(() => queries.from("catalog_items")
    .select("id").eq("site_id", siteId).eq("parent_id", itemId), 5_000)
  const ids = [itemId, ...variants.map(item => item.id)]
  const lines: CatalogSaleLine[] = []
  for (let offset = 0; offset < ids.length; offset += 100) {
    // Read the item's complete history: legacy sales may have a null sale_date.
    // A bounded scan fails explicitly rather than displaying truncated monetary totals.
    const batch = await readSalesPages<CatalogSaleLine>(() => queries.from("sale_order_items")
      .select(LINE_FIELDS).is("parent_sale_order_item_id", null)
      .eq("site_id", siteId).eq("order.site_id", siteId).eq("order.sale.site_id", siteId)
      .in("catalog_item_id", ids.slice(offset, offset + 100))
      .in("order.sale.status", ["completed", "paid"]), 50_000 - lines.length)
    lines.push(...batch)
    if (lines.length >= 50_000 && offset + 100 < ids.length) {
      throw new SalesReportLimitError("Too much item sales history to load safely.")
    }
  }
  const rows = catalogSaleRows(lines, siteId, start, end)
  return { rows, availableCurrencies: [...new Set(rows.map(row => row.currency))].sort() }
}