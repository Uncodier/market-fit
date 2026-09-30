import { buildSalesTrend, salesTrendDay, salesTrendRange } from "@/app/components/dashboard/sales-trend-data"
import type { SalesDailyTrendPoint } from "@/lib/sales/report-types"

const day = (date: string, totalSales = 10): SalesDailyTrendPoint => ({
  date, onlineSales: totalSales / 2, retailSales: totalSales / 4, otherSales: totalSales / 4, totalSales,
})
const coverage = (startDate: string, endDate: string) => ({ startDate, endDate, complete: true })

describe("adaptive sales periods", () => {
  it("shows all 30 selected days with real daily values, not one monthly amount", () => {
    const trend = buildSalesTrend({ data: [{ month: "2025-06", onlineSales: 999, retailSales: 0 }],
      dailyData: [day("2025-06-03", 100), day("2025-06-20", 50)],
      startDate: "2025-06-01", endDate: "2025-06-30", coverage: coverage("2025-06-01", "2025-06-30") })
    expect(trend.granularity).toBe("daily")
    expect(trend.points).toHaveLength(30)
    expect(trend.points[0]).toMatchObject({ date: "2025-06-01", totalSales: 0 })
    expect(trend.points[2]).toMatchObject({ date: "2025-06-03", totalSales: 100 })
    expect(trend.points.reduce((sum, point) => sum + point.totalSales!, 0)).toBe(150)
    expect(trend.hasGaps).toBe(false)
  })

  it("uses selected-start seven-day weeks, clipping the final partial week", () => {
    const trend = buildSalesTrend({ data: [], dailyData: [day("2024-12-27"), day("2025-01-02"), day("2025-02-11")],
      startDate: "2024-12-27", endDate: "2025-02-11", coverage: coverage("2024-12-27", "2025-02-11") })
    expect(trend.granularity).toBe("weekly")
    expect(trend.points).toHaveLength(7)
    expect(trend.points[0]).toMatchObject({ date: "2024-12-27", endDate: "2025-01-02", totalSales: 20 })
    expect(trend.points[6]).toMatchObject({ date: "2025-02-07", endDate: "2025-02-11", totalSales: 10 })
    expect(trend.points[0].label).toContain("24")
    expect(trend.points[6].label).toContain("25")
  })

  it("uses calendar months for long ranges, clips edge months and does not leak rows beyond dates", () => {
    const trend = buildSalesTrend({ data: [], dailyData: [day("2024-11-09", 999), day("2024-11-10", 30),
      day("2025-05-15", 20), day("2025-05-16", 888)], startDate: "2024-11-10", endDate: "2025-05-15",
    coverage: coverage("2024-11-10", "2025-05-15") })
    expect(trend.granularity).toBe("monthly")
    expect(trend.points).toHaveLength(7)
    expect(trend.points[0]).toMatchObject({ date: "2024-11-10", endDate: "2024-11-30", totalSales: 30 })
    expect(trend.points[6]).toMatchObject({ date: "2025-05-01", endDate: "2025-05-15", totalSales: 20 })
  })

  it("derives bounds from historical data and handles a single observation without now/year defaults", () => {
    const trend = buildSalesTrend({ data: [], dailyData: [day("1999-04-02")] })
    expect(trend).toMatchObject({ startDate: "1999-04-02", endDate: "1999-04-02", granularity: "daily" })
    expect(trend.points).toHaveLength(1)
    expect(trend.points[0].totalSales).toBe(10)
    expect(salesTrendRange(trend.startDate, trend.endDate)).toBe("Apr 2, 1999")
  })

  it("preserves selected local calendar days and includes leap day without DST drift", () => {
    expect(salesTrendDay(new Date(2024, 1, 29, 22))).toBe("2024-02-29")
    const trend = buildSalesTrend({ data: [], dailyData: [], startDate: "2024-02-28", endDate: "2024-03-01",
      coverage: coverage("2024-02-28", "2024-03-01") })
    expect(trend.points.map(point => point.date)).toEqual(["2024-02-28", "2024-02-29", "2024-03-01"])
    expect(buildSalesTrend({ data: [], dailyData: [], startDate: "2025-02-30", endDate: "2025-03-01" }).points).toEqual([])
    expect(buildSalesTrend({ data: [], dailyData: [], startDate: "2025-03-02", endDate: "2025-03-01" }).points).toEqual([])
  })
})

describe("known zero versus unavailable sales data", () => {
  it("leaves absent observations unavailable without complete coverage, including days outside coverage", () => {
    const input = { data: [], dailyData: [day("2025-05-02")], startDate: "2025-05-01", endDate: "2025-05-04" }
    expect(buildSalesTrend(input).points.map(point => point.totalSales)).toEqual([null, 10, null, null])
    expect(buildSalesTrend({ ...input, coverage: coverage("2025-05-02", "2025-05-03") }).points.map(point => point.totalSales))
      .toEqual([null, 10, 0, null])
    expect(buildSalesTrend({ ...input, coverage: { ...coverage("2025-05-01", "2025-05-04"), complete: false } }).hasGaps).toBe(true)
  })

  it("does not promote incomplete weeks or malformed daily values into complete sums", () => {
    const input = { data: [], dailyData: [day("2025-01-01")], startDate: "2025-01-01", endDate: "2025-03-01" }
    expect(buildSalesTrend(input).points[0].totalSales).toBeNull()
    expect(buildSalesTrend({ ...input, coverage: coverage(input.startDate, input.endDate),
      dailyData: [day("2025-01-01", NaN)] }).points[0].totalSales).toBeNull()
    expect(buildSalesTrend({ ...input, coverage: coverage(input.startDate, input.endDate),
      dailyData: [day("2025-01-01"), day("2025-01-01")] }).points[0].totalSales).toBeNull()
  })

  it("never invents daily points from a legacy monthly response and sums channels when total is absent", () => {
    const trend = buildSalesTrend({ data: [{ month: "2025-01", onlineSales: 100, retailSales: 20 },
      { month: "2025-02", onlineSales: 900, retailSales: 0 }], startDate: "2025-01-10", endDate: "2025-01-20" })
    expect(trend).toMatchObject({ legacy: true, granularity: "monthly", startDate: "2025-01-10", endDate: "2025-01-20" })
    expect(trend.points).toHaveLength(1)
    expect(trend.points[0]).toMatchObject({ totalSales: 120, otherSales: 0 })
  })

  it("does not fill absent monthly buckets or replace explicitly unavailable daily data with monthly totals", () => {
    const input = { data: [{ month: "2025-01", onlineSales: 100, retailSales: 0 }], startDate: "2025-01-01", endDate: "2025-02-28" }
    expect(buildSalesTrend(input).points.map(point => point.totalSales)).toEqual([100, null])
    expect(buildSalesTrend({ ...input, dailyData: [] }).points.every(point => point.totalSales === null)).toBe(true)
  })

  it("preserves undated legacy month labels without assigning the current year", () => {
    const trend = buildSalesTrend({ data: [{ month: "Jan", onlineSales: 3, retailSales: 2 }] })
    expect(trend.startDate).toBeUndefined()
    expect(trend.points[0]).toMatchObject({ label: "Jan", totalSales: 5 })
  })

  it("does not guess a year for legacy labels when a selected period needs dated evidence", () => {
    const trend = buildSalesTrend({ data: [{ month: "Jan", onlineSales: 3, retailSales: 2 }],
      startDate: "2020-01-01", endDate: "2020-01-31" })
    expect(trend.points[0].totalSales).toBeNull()
    expect(trend.hasGaps).toBe(true)
  })
})