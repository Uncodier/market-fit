import { queryReportSales, readSalesPages, SalesReportLimitError, type ReportRefund, type SalesClient } from "@/app/api/sales/sales-query"
import type { SalesReportPeriod } from "@/lib/sales/report-period"
import { saleCalendarDate } from "./revenue-aggregations"

type ReportOrder = { id: string; sale_id: string; status: string }

async function relatedRows<T extends { id: string }>(client: SalesClient, siteId: string, table: string, fields: string, saleIds: string[]) {
  const rows: T[] = []
  for (let i = 0; i < saleIds.length; i += 100) {
    rows.push(...await readSalesPages<T>(() => client.from(table).select(fields)
      .eq("site_id", siteId).in("sale_id", saleIds.slice(i, i + 100)), 50_000 - rows.length))
    if (rows.length > 50_000) throw new SalesReportLimitError("Too many related sales records. Select a segment.")
  }
  return rows
}

/** All reads use the authorized user's client and explicit tenant scope. No writes. */
export async function loadSalesReportSources(client: SalesClient, siteId: string, segmentId: string, period: SalesReportPeriod) {
  const sales = await queryReportSales(client, siteId, segmentId)
  const cohort = sales.filter(sale => saleCalendarDate(sale) >= period.previousStart && saleCalendarDate(sale) <= period.end)
  const [orders, refunds] = await Promise.all([
    relatedRows<ReportOrder>(client, siteId, "sale_orders", "id, sale_id, status", cohort.map(sale => sale.id)),
    relatedRows<ReportRefund>(client, siteId, "accounting_sale_refunds", "id, sale_id, amount, currency, refunded_at", sales.map(sale => sale.id)),
  ])
  const ordersBySale = new Map<string, string[]>()
  const refundsBySale = new Map<string, ReportRefund[]>()
  for (const order of orders) ordersBySale.set(order.sale_id, [...(ordersBySale.get(order.sale_id) || []), order.status])
  for (const refund of refunds) refundsBySale.set(refund.sale_id, [...(refundsBySale.get(refund.sale_id) || []), refund])
  return sales.map(sale => ({ ...sale, order_statuses: ordersBySale.get(sale.id) || [], refunds: refundsBySale.get(sale.id) || [] }))
}