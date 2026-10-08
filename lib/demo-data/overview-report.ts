import { buildSalesReport } from "@/app/api/revenue/build-sales-report"
import type { ReportSale } from "@/app/api/sales/sales-query"
import { isRecognizedRevenueSale } from "@/lib/sales/recognized-sale"
import { selectLiveCampaigns } from "@/lib/dashboard/active-campaigns"
import { reportMetricKeys, type ReportBatch, type ReportBatchKind } from "@/lib/dashboard/report-groups"
import { createDemoMockClient } from "./mock-client"
import { demoMetric, demoReportContext, type DemoReportContext, type DemoRow } from "./report-context"
import { buildDemoOutcomes } from "./activity-report"

function demoSales(context: DemoReportContext) {
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

async function summary(context: DemoReportContext): Promise<ReportBatch> {
  const { siteId, period, segmentId, currency, rows, scoped, inRange } = context
  const sales = demoSales(context)
  // This existing fixture client is only used for local category reads; Overview omits them.
  const revenue = await buildSalesReport(createDemoMockClient(siteId), sales, period, {
    currency, segmentId, siteCurrency: currency, includeCategories: false,
  })
  const customers = (previous = false) => new Set(sales.filter(sale =>
    sale.status === "completed" && isRecognizedRevenueSale(sale) && inRange(sale.created_at, previous))
    .map(sale => sale.lead_id).filter(Boolean)).size
  const segments = rows("segments").filter(row => row.is_active)
  const campaigns = scoped("campaigns")
  return {
    revenue: { ...revenue },
    "active-users": demoMetric(customers(), customers(true)),
    "active-segments": demoMetric(segments.length, segments.filter(row => row.created_at < period.start).length),
    "active-campaigns": demoMetric(selectLiveCampaigns(campaigns).length,
      selectLiveCampaigns(campaigns, new Date(`${period.start}T00:00:00Z`)).length),
  }
}

function economics(context: DemoReportContext): ReportBatch {
  const { scoped, inRange, currency } = context
  const sales = demoSales(context).filter(sale => sale.currency === currency &&
    isRecognizedRevenueSale(sale) && inRange(sale.sale_date || sale.created_at))
  const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.amount || 0), 0)
  const paid = sales.filter(sale => sale.status === "completed")
  const customers = new Set(paid.map(sale => sale.lead_id).filter(Boolean)).size
  const paidRevenue = paid.reduce((sum, sale) => sum + Number(sale.amount || 0), 0)
  const totalTransactions = scoped("transactions").filter(row => row.currency === currency && inRange(row.created_at))
    .reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0)), 0)
  const leadsCount = scoped("leads").filter(row => inRange(row.created_at)).length
  const monetary = (actual: number, noData: boolean) => ({ actual, currency, noData, periodType: "custom" })
  return {
    ltv: monetary(customers ? paidRevenue / customers : 0, !customers),
    cac: { ...monetary(customers ? totalTransactions / customers : 0, !customers), details: { costSource: "transactions" } },
    cpl: { ...monetary(leadsCount ? totalTransactions / leadsCount : 0, !leadsCount), metadata: { leadsCount } },
    roi: {
      ...monetary(totalTransactions ? (totalRevenue - totalTransactions) / totalTransactions * 100 : 0, !totalTransactions),
      details: { totalRevenue, totalTransactions, campaignBudget: 0 },
    },
  }
}

/** Local fixture adapter. No API handler, authentication bypass, or network interception. */
export async function loadDemoDashboardBatch(kind: ReportBatchKind, params: URLSearchParams): Promise<ReportBatch> {
  const group = params.get("group") ?? undefined
  const keys = reportMetricKeys(kind, group)
  if (!keys) throw new Error("Unknown demo report section")
  const context = await demoReportContext(params)
  if (kind === "performance") {
    if (group !== "outcomes") throw new Error("This demo report section is not available")
    return buildDemoOutcomes(context)
  }
  const data: ReportBatch = {
    ...(keys.includes("revenue") ? await summary(context) : {}),
    ...(keys.includes("ltv") ? economics(context) : {}),
  }
  return Object.fromEntries(keys.map(key => [key, data[key]]))
}