import { buildDailyChannelData, buildMonthlyChannelData } from "@/app/api/revenue/revenue-aggregations"
import { buildSalesReport } from "@/app/api/revenue/build-sales-report"
import { salesReportPeriod } from "@/lib/sales/report-period"
import type { ReportSale } from "@/app/api/sales/sales-query"

const sale = (date: string, amount: number, source = "shop", extra: Partial<ReportSale> = {}): ReportSale => ({
  id: `${date}-${amount}`, sale_date: date, created_at: `${date}T12:00:00Z`, amount, source,
  status: "completed", currency: "USD", ...extra,
})

describe("daily revenue contract", () => {
  it("indexes sale dates, applies created-date fallback only when missing, and zero-fills the known complete interval", () => {
    const result = buildDailyChannelData([
      sale("2024-02-28", 10), sale("2024-02-28", 20, "POS"),
      sale("2024-02-29", 30, "quote", { sale_date: null }),
      sale("2024-02-28", 7, "marketplace", { created_at: "2024-03-01T00:00:00Z", status: "pending" }),
    ], "2024-02-28", "2024-03-01")
    expect(result).toEqual([
      { date: "2024-02-28", onlineSales: 17, retailSales: 20, otherSales: 0, totalSales: 37 },
      { date: "2024-02-29", onlineSales: 0, retailSales: 0, otherSales: 30, totalSales: 30 },
      { date: "2024-03-01", onlineSales: 0, retailSales: 0, otherSales: 0, totalSales: 0 },
    ])
  })

  it("excludes out-of-bound rows even within edge months and excludes cancelled/refunded amounts", () => {
    const rows = [sale("2025-01-09", 100), sale("2025-01-10", 5), sale("2025-01-20", 10), sale("2025-01-21", 200),
      sale("2025-01-12", 300, "shop", { status: "cancelled" }), sale("2025-01-14", 400, "shop", { status: "refunded" })]
    const daily = buildDailyChannelData(rows, "2025-01-10", "2025-01-20")
    expect(daily).toHaveLength(11)
    expect(daily.reduce((sum, point) => sum + point.totalSales, 0)).toBe(15)
    expect(buildMonthlyChannelData(rows, "2025-01-10", "2025-01-20")).toEqual([
      { month: "2025-01", onlineSales: 15, retailSales: 0, otherSales: 0, totalSales: 15 },
    ])
  })

  it("adds dailyData with explicit complete bounds without querying or changing the monthly contract", async () => {
    const client = { from: jest.fn(() => { throw new Error("Unexpected query") }) }
    const period = salesReportPeriod(new URLSearchParams({ startDate: "2024-12-31", endDate: "2025-01-02" }))
    const result = await buildSalesReport(client, [sale("2024-12-30", 99), sale("2024-12-31", 10),
      sale("2025-01-02", 20, "quote"), sale("2025-01-02", 900, "shop", { currency: "EUR" })], period,
    { currency: "USD", segmentId: "all", includeCategories: false })
    expect(client.from).not.toHaveBeenCalled()
    expect(result.metadata.trendCoverage).toEqual({ startDate: "2024-12-31", endDate: "2025-01-02", complete: true })
    expect(result.dailyData?.map(point => [point.date, point.totalSales])).toEqual([
      ["2024-12-31", 10], ["2025-01-01", 0], ["2025-01-02", 20],
    ])
    expect(result.dailyData?.reduce((sum, point) => sum + point.totalSales, 0)).toBe(result.totalSales.actual)
    expect(result.monthlyData.map(point => [point.month, point.totalSales])).toEqual([["2024-12", 10], ["2025-01", 20]])
  })

  it("declares an empty successful report complete with real zero days, not an unavailable response", async () => {
    const result = await buildSalesReport({ from: jest.fn() }, [],
      salesReportPeriod(new URLSearchParams({ startDate: "2020-05-04", endDate: "2020-05-04" })),
      { currency: null, segmentId: "all", includeCategories: false })
    expect(result.noData).toBe(true)
    expect(result.dailyData).toEqual([{ date: "2020-05-04", onlineSales: 0, retailSales: 0, otherSales: 0, totalSales: 0 }])
    expect(result.metadata.trendCoverage?.complete).toBe(true)
  })
})