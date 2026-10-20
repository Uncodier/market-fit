import { availableDemos, getDemoData } from "@/lib/demo-data"
import { loadDemoSalesReport } from "@/lib/demo-data/sales-report"
import { loadDemoCostReport } from "@/lib/demo-data/cost-report"
import { attachDemoFinancial } from "@/lib/demo-data/financial-seed"
import { shiftDay } from "@/lib/sales/report-period"
import { costEfficiency } from "@/app/components/dashboard/cost-report-data"
import { marketingFromCategories, overheadFromCategories } from "@/lib/costs/aggregate-costs"

const today = new Date().toISOString().slice(0, 10)
const filters = (siteId: string, segmentId = "all", startDate = shiftDay(today, -29), endDate = today) =>
  new URLSearchParams({ siteId, segmentId, startDate, endDate })

describe.each(availableDemos)("financial demo reports: $id", ({ id }) => {
  it("populates all sales sections and reconciles channel/category totals", async () => {
    const report = await loadDemoSalesReport(filters(id))
    expect(report.totalSales.actual).toBeGreaterThan(0)
    expect(report.totalSales.previous).toBeGreaterThan(0)
    expect(report.channelSales.online.amount).toBeGreaterThan(0)
    expect(report.channelSales.retail.amount).toBeGreaterThan(0)
    expect(report.salesCategories.length).toBeGreaterThan(0)
    expect(report.dailyData).toHaveLength(30)
    expect(report.dailyData!.reduce((sum, row) => sum + row.totalSales, 0)).toBeCloseTo(report.totalSales.actual)
    expect(report.salesCategories.reduce((sum, row) => sum + row.amount, 0)).toBeCloseTo(report.totalSales.actual)
    expect(report.metadata.categoriesIncluded).toBe(true)
    expect(report.financialSummary?.paymentStatus.paid.count).toBeGreaterThan(0)
    expect(report.financialSummary?.paymentStatus.unpaid.count).toBeGreaterThan(0)
    expect(report.financialSummary?.paymentStatus.partial.count).toBeGreaterThan(0)
    expect(report.financialSummary?.outstanding.amount).toBeGreaterThan(0)
    expect(report.financialSummary?.receipts?.actual).toBeGreaterThan(0)
    expect(report.financialSummary?.refunds?.actual).toBeGreaterThan(0)
    expect(report.financialSummary?.netCollected).not.toBeNull()
    expect(report.financialSummary?.excluded.count).toBeGreaterThan(0)
    expect(report.financialSummary?.cashIssues).toBe(0)
  })

  it("populates cost summary, categories and matching sales efficiency", async () => {
    const costs = await loadDemoCostReport(filters(id))
    const sales = await loadDemoSalesReport(filters(id))
    expect(costs.totalCosts.actual).toBeGreaterThan(0)
    expect(costs.totalCosts.previous).toBeGreaterThan(0)
    expect(costs.costCategories.length).toBeGreaterThan(2)
    expect(costs.costDistribution.reduce((sum, row) => sum + row.amount, 0)).toBeCloseTo(costs.totalCosts.actual)
    expect(marketingFromCategories(costs.costCategories).amount).toBeGreaterThan(0)
    expect(overheadFromCategories(costs.costCategories).amount).toBeGreaterThan(0)
    expect(costs.monthlyData.some(row => row.fixedCosts > 0 && row.variableCosts > 0)).toBe(true)
    expect(costEfficiency(costs, sales).ratio).toBeGreaterThan(0)
  })

  it("covers every segment, campaign filters and empty ranges without invented totals", async () => {
    const data = await getDemoData(id)
    for (const segment of data!.segments) {
      expect((await loadDemoSalesReport(filters(id, segment.id))).totalSales.actual).toBeGreaterThan(0)
      expect((await loadDemoCostReport(filters(id, segment.id))).totalCosts.actual).toBeGreaterThan(0)
      const campaign = data!.campaigns.find((row: { segment_id?: string }) => row.segment_id === segment.id)
      const params = filters(id, segment.id)
      params.set("campaignId", campaign.id)
      expect((await loadDemoCostReport(params)).totalCosts.actual).toBeGreaterThan(0)
    }
    for (const params of [filters(id, "missing-segment"), filters(id, "all", shiftDay(today, 365), shiftDay(today, 394))]) {
      expect((await loadDemoSalesReport(params)).totalSales.actual).toBe(0)
      expect((await loadDemoCostReport(params)).totalCosts.actual).toBe(0)
    }
    const before = JSON.stringify(data)
    const refreshed = attachDemoFinancial(data!)
    expect(JSON.stringify(data)).toBe(before)
    expect(refreshed.transactions).toHaveLength(data!.transactions.length)
  })
})

it("rejects unknown demos, real sites, invalid ranges and currencies", async () => {
  for (const siteId of ["demo-unknown", "real-site", ""]) {
    await expect(loadDemoSalesReport(filters(siteId))).rejects.toThrow("Unknown demo site")
    await expect(loadDemoCostReport(filters(siteId))).rejects.toThrow("Unknown demo site")
  }
  const params = filters(availableDemos[0].id)
  params.set("currency", "bad")
  await expect(loadDemoSalesReport(params)).rejects.toThrow("currency")
  await expect(loadDemoCostReport(params)).rejects.toThrow("currency")
  const oversized = filters(availableDemos[0].id, "all", shiftDay(today, -367))
  await expect(loadDemoCostReport(oversized)).rejects.toThrow("too large")
})

it("keeps explicit currency changes separate", async () => {
  const params = filters("demo-habituall", "all", shiftDay(today, -92))
  const mxn = await loadDemoSalesReport(params)
  params.set("currency", "USD")
  const usd = await loadDemoSalesReport(params)
  expect(mxn.currency).toBe("MXN")
  expect(usd.currency).toBe("USD")
  expect(mxn.totalSales.actual).not.toBe(usd.totalSales.actual)
})