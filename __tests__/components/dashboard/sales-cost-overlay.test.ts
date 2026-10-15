import { buildSalesCostOverlay } from "@/app/components/dashboard/sales-cost-overlay"
import { buildSalesPaymentStack } from "@/app/components/dashboard/sales-payment-stack"
import { buildPendingSalesTrend, buildSalesTrend } from "@/app/components/dashboard/sales-trend-data"
import type { OverviewPeriodCosts } from "@/lib/sales/report-types"

function points(startDate: string, endDate: string) {
  const input = { data: [], dailyData: [], startDate, endDate, coverage: { startDate, endDate, complete: true } }
  const trend = buildSalesTrend(input)
  return buildSalesPaymentStack(trend, buildPendingSalesTrend(input, trend))
}

function costs(startDate: string, endDate: string, dailyData: OverviewPeriodCosts["dailyData"]): OverviewPeriodCosts {
  return { dailyData, coverage: { startDate, endDate, complete: true }, currency: "MXN",
    expensesScope: "site", purchasesScope: "site" }
}

describe("recorded period cost overlays", () => {
  it("pads covered daily gaps and retains exact separate expense/purchase amounts", () => {
    const start = "2026-10-01", end = "2026-10-03"
    const data = costs(start, end, [{ date: start, expenses: 0.1, purchases: 0.2 },
      { date: end, expenses: 12.35, purchases: 456.78 }])
    expect(buildSalesCostOverlay(points(start, end), data, "MXN").map(({ expenses, purchases }) => [expenses, purchases]))
      .toEqual([[0.1, 0.2], [0, 0], [12.35, 456.78]])
  })

  it.each([
    ["2026-01-03", "2026-03-02", "2026-01-09", "2026-01-10", "2026-01-09"],
    ["2026-01-03", "2026-09-02", "2026-01-31", "2026-02-01", "2026-01-31"],
  ])("uses clipped sales buckets for %s – %s", (start, end, last, next, expectedEnd) => {
    const data = costs(start, end, [{ date: start, expenses: 0.1, purchases: 100 },
      { date: last, expenses: 0.2, purchases: 20 }, { date: next, expenses: 99, purchases: 30 },
      { date: "2025-12-31", expenses: 999, purchases: 999 }])
    const result = buildSalesCostOverlay(points(start, end), data, "MXN")
    expect(result[0]).toMatchObject({ date: start, endDate: expectedEnd, expenses: 0.3, purchases: 120 })
    expect(result[1]).toMatchObject({ expenses: 99, purchases: 30 })
    expect(result.at(-1)?.endDate).toBe(end)
  })

  it("does not turn absent, incomplete, malformed or wrong-currency data into zero costs", () => {
    const start = "2026-10-01", end = "2026-10-03"
    const buckets = points(start, end)
    expect(buildSalesCostOverlay(buckets, undefined, "MXN").every(point => point.expenses === null && point.purchases === null)).toBe(true)
    const data = costs(start, end, [{ date: start, expenses: 10, purchases: 20 }])
    expect(buildSalesCostOverlay(buckets, data, "USD").every(point => point.expenses === null && point.purchases === null)).toBe(true)
    data.coverage.complete = false
    expect(buildSalesCostOverlay(buckets, data, "MXN").map(point => point.expenses)).toEqual([10, null, null])
    data.dailyData.push({ date: start, expenses: 5, purchases: 5 })
    expect(buildSalesCostOverlay(buckets, data, "MXN")[0]).toMatchObject({ expenses: null, purchases: null })
  })

  it("keeps an incomplete weekly expense bucket unavailable without dropping known purchases", () => {
    const start = "2026-01-01", end = "2026-03-01"
    const data = costs(start, end, [{ date: start, expenses: null, purchases: 12 }])
    expect(buildSalesCostOverlay(points(start, end), data, "MXN")[0]).toMatchObject({ expenses: null, purchases: 12 })
  })
})