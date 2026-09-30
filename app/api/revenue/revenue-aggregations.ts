import { isRecognizedRevenueSale } from "@/lib/sales/recognized-sale"
import { salesPercentChange } from "@/lib/sales/report-format"
import { shiftDay } from "@/lib/sales/report-period"
import type { SalesChannelAmounts, SalesDailyTrendPoint, SalesTrendPoint } from "@/lib/sales/report-types"
import { readSalesPages, type ReportSale, type SalesClient } from "@/app/api/sales/sales-query"

export { isRecognizedRevenueSale }
export const percentChangeFrom = salesPercentChange

export function isOnlineSource(source: string | null | undefined): boolean {
  return ["online", "shop", "marketplace"].includes(source?.toLowerCase() || "")
}

export function isRetailSource(source: string | null | undefined): boolean {
  return ["retail", "pos"].includes(source?.toLowerCase() || "")
}

export function getSalesAmount(sale: { amount?: unknown } | null): number {
  if (sale?.amount == null) return 0
  const amount = Number(sale.amount)
  if (!Number.isFinite(amount)) throw new Error("Invalid sale amount")
  return amount
}

export function saleCalendarDate(sale: { sale_date?: string | null; created_at?: string | null }): string {
  return (sale.sale_date || sale.created_at || "").slice(0, 10)
}

export function salesInLocalRange<T extends {
  status?: string | null; sale_date?: string | null; created_at?: string | null
}>(sales: T[], start: string, end: string): T[] {
  return sales.filter((sale) => isRecognizedRevenueSale(sale) &&
    saleCalendarDate(sale) >= start && saleCalendarDate(sale) <= end)
}

export function mergeSalesById<T extends { id?: string }>(...groups: Array<T[] | null | undefined>): T[] {
  return Array.from(new Map(groups.flatMap((group) => group || [])
    .filter((sale) => sale.id).map((sale) => [sale.id, sale])).values())
}

type Order = { id: string; sale_id: string }
type CategoryRelation = { name: string }
type CatalogRelation = { category: CategoryRelation | CategoryRelation[] | null }
type OrderItem = {
  id: string
  sale_order_id: string
  subtotal: number | string
  parent_sale_order_item_id: string | null
  catalog_item: CatalogRelation | CatalogRelation[] | null
}

async function readRelatedRows<T>(client: SalesClient, table: string, fields: string, column: string, ids: string[]) {
  const rows: T[] = []
  for (let i = 0; i < ids.length; i += 100) {
    rows.push(...await readSalesPages<T>(() => client.from(table).select(fields).in(column, ids.slice(i, i + 100))))
  }
  return rows
}

/** Allocate each sale's confirmed amount by its top-level item subtotal weights. */
export async function aggregateSalesByCategory(client: SalesClient, sales: ReportSale[]): Promise<Map<string, number>> {
  const categories = new Map<string, number>()
  if (!sales.length) return categories
  const orders = await readRelatedRows<Order>(client, "sale_orders", "id, sale_id", "sale_id", sales.map((s) => s.id))
  const saleByOrder = new Map(orders.map((order) => [order.id, order.sale_id]))
  const items = await readRelatedRows<OrderItem>(client, "sale_order_items",
    "id, sale_order_id, subtotal, parent_sale_order_item_id, catalog_item:catalog_items(category:catalog_categories(name))",
    "sale_order_id", orders.map((order) => order.id))
  const weights = new Map<string, Map<string, number>>()
  for (const item of items) {
    if (item.parent_sale_order_item_id) continue
    const saleId = saleByOrder.get(item.sale_order_id)
    if (!saleId) continue
    const catalog = Array.isArray(item.catalog_item) ? item.catalog_item[0] : item.catalog_item
    const category = Array.isArray(catalog?.category) ? catalog.category[0] : catalog?.category
    const name = category?.name?.trim() || "Uncategorized"
    const subtotal = getSalesAmount({ amount: item.subtotal })
    if (subtotal <= 0) continue
    const saleWeights = weights.get(saleId) || new Map<string, number>()
    saleWeights.set(name, (saleWeights.get(name) || 0) + subtotal)
    weights.set(saleId, saleWeights)
  }
  const add = (name: string, amount: number) => categories.set(name, (categories.get(name) || 0) + amount)
  for (const sale of sales) {
    const amount = getSalesAmount(sale)
    const saleWeights = weights.get(sale.id)
    const total = Array.from(saleWeights?.values() || []).reduce((sum, value) => sum + value, 0)
    if (!saleWeights || total <= 0) {
      add(sale.product_type?.trim() || sale.product_category?.trim() || "Uncategorized", amount)
      continue
    }
    for (const [name, weight] of saleWeights) add(name, amount * weight / total)
  }
  return categories
}

function buildChannelData(sales: ReportSale[], start: string, end: string, daily: boolean) {
  const buckets = new Map<string, SalesChannelAmounts>()
  for (let day = start; day <= end; day = shiftDay(day, 1)) {
    const key = daily ? day : day.slice(0, 7)
    if (!buckets.has(key)) buckets.set(key, {
      onlineSales: 0, retailSales: 0, otherSales: 0, totalSales: 0,
    })
  }
  for (const sale of sales) {
    const date = saleCalendarDate(sale)
    if (!isRecognizedRevenueSale(sale) || date < start || date > end) continue
    const bucket = buckets.get(daily ? date : date.slice(0, 7))
    if (!bucket) continue
    const amount = getSalesAmount(sale)
    const key = isOnlineSource(sale.source) ? "onlineSales" : isRetailSource(sale.source) ? "retailSales" : "otherSales"
    bucket[key] += amount
    bucket.totalSales += amount
  }
  return buckets
}

/** Keep the legacy monthly contract, including only dates in the requested interval. */
export function buildMonthlyChannelData(sales: ReportSale[], start: string, end: string): SalesTrendPoint[] {
  return Array.from(buildChannelData(sales, start, end, false), ([month, amounts]) => ({ month, ...amounts }))
}

/** Reuse the complete, currency-scoped rows already queried by the report; no bucket queries. */
export function buildDailyChannelData(sales: ReportSale[], start: string, end: string): SalesDailyTrendPoint[] {
  return Array.from(buildChannelData(sales, start, end, true), ([date, amounts]) => ({ date, ...amounts }))
}