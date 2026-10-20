import { buildSalesReport } from "@/app/api/revenue/build-sales-report"
import { buildOverviewPeriodCosts } from "@/app/api/dashboard/overview/period-costs"
import { isRecognizedRevenueSale } from "@/lib/sales/recognized-sale"
import { selectLiveCampaigns } from "@/lib/dashboard/active-campaigns"
import { reportMetricKeys, type ReportBatch, type ReportBatchKind } from "@/lib/dashboard/report-groups"
import { createDemoMockClient } from "./mock-client"
import { demoMetric, demoReportContext, type DemoReportContext } from "./report-context"
import { buildDemoSales } from "./sales-report"
import { buildDemoPerformance } from "./performance-report"

async function summary(context: DemoReportContext): Promise<ReportBatch> {
  const { siteId, period, segmentId, currency, rows, scoped, inRange } = context
  const sales = buildDemoSales(context)
  // This existing fixture client is only used for local category reads; Overview omits them.
  const revenue = await buildSalesReport(createDemoMockClient(siteId), sales, period, {
    currency, segmentId, siteCurrency: currency, includeCategories: false,
  })
  const customers = (previous = false) => new Set(sales.filter(sale =>
    sale.status === "completed" && isRecognizedRevenueSale(sale) && inRange(sale.created_at, previous))
    .map(sale => sale.lead_id).filter(Boolean)).size
  const segments = rows("segments").filter(row => row.is_active)
  const campaigns = scoped("campaigns")
  const periodCosts = buildOverviewPeriodCosts(scoped("transactions").map(row => ({
    amount: row.amount ?? null, currency: row.currency, type: row.type,
    category: typeof row.category === "string" ? row.category : null,
    sale_order_id: row.sale_order_id, date: typeof row.date === "string" ? row.date : "",
  })), rows("purchases").map(row => ({
    amount: row.amount ?? null, currency: row.currency, status: row.status || "",
    purchase_date: typeof row.purchase_date === "string" ? row.purchase_date : "",
  })), period, revenue.currency, segmentId)
  return {
    revenue: { ...revenue, periodCosts },
    "active-users": demoMetric(customers(), customers(true)),
    "active-segments": demoMetric(segments.length, segments.filter(row => row.created_at < period.start).length),
    "active-campaigns": demoMetric(selectLiveCampaigns(campaigns).length,
      selectLiveCampaigns(campaigns, new Date(`${period.start}T00:00:00Z`)).length),
  }
}

function economics(context: DemoReportContext): ReportBatch {
  const { scoped, inRange, currency } = context
  const sales = buildDemoSales(context).filter(sale => sale.currency === currency &&
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
    return buildDemoPerformance(context, group)
  }
  const data: ReportBatch = {
    ...(keys.includes("revenue") ? await summary(context) : {}),
    ...(keys.includes("ltv") ? economics(context) : {}),
  }
  return Object.fromEntries(keys.map(key => [key, data[key]]))
}