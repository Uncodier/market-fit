import { buildSalesReport } from "@/app/api/revenue/build-sales-report"
import type { ReportSale } from "@/app/api/sales/sales-query"
import { createDemoMockClient } from "./mock-client"
import { demoReportContext, type DemoReportContext, type DemoRow } from "./report-context"

/** Resolve fixture relations using the same sale, order and refund sources as real reports. */
export function buildDemoSales(context: DemoReportContext) {
  return context.scoped("sales").map(row => ({
    ...row,
    status: row.status || "", amount: row.amount ?? null,
    order_statuses: context.rows("sale_orders").filter(order => order.sale_id === row.id).map(order => order.status || ""),
    refunds: context.rows("accounting_sale_refunds").filter(refund => refund.sale_id === row.id).map(refund => ({
      id: refund.id, sale_id: row.id, amount: refund.amount ?? 0,
      currency: refund.currency || "UNSPECIFIED", refunded_at: String(refund.refunded_at || ""),
    })),
  })) satisfies (ReportSale & DemoRow)[]
}

export async function loadDemoSalesReport(params: URLSearchParams) {
  const context = await demoReportContext(params)
  const currency = params.get("currency") || context.currency
  if (currency && !/^(?:[A-Z]{3}|UNSPECIFIED)$/.test(currency)) throw new Error("Invalid report currency")
  const categories = params.get("includeCategories")
  if (categories !== null && categories !== "true" && categories !== "false") throw new Error("Invalid category option")
  return buildSalesReport(createDemoMockClient(context.siteId), buildDemoSales(context), context.period, {
    currency, siteCurrency: context.currency, segmentId: context.segmentId, includeCategories: categories !== "false",
  })
}