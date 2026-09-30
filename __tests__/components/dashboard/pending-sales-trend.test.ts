import { buildPendingSalesTrend, buildSalesTrend } from "@/app/components/dashboard/sales-trend-data"
import type { SalesPendingDailyTrendPoint } from "@/lib/sales/report-types"

const day = (date: string, totalSales: number | null): SalesPendingDailyTrendPoint => ({
  date, onlineSales: totalSales, retailSales: totalSales === null ? null : 0, otherSales: totalSales === null ? null : 0, totalSales,
})

it.each([
  ["2025-01-01", "2025-01-03", "daily"],
  ["2025-01-01", "2025-02-20", "weekly"],
  ["2025-01-01", "2025-08-15", "monthly"],
])("aligns pending to the same %s–%s %s buckets", (startDate, endDate, granularity) => {
  const input = { data: [], dailyData: [], startDate, endDate, coverage: { startDate, endDate, complete: true },
    dailyPendingData: [day(startDate, 30), day(endDate, 20)] }
  const active = buildSalesTrend(input)
  const pending = buildPendingSalesTrend(input, active)
  expect(pending.granularity).toBe(granularity)
  expect(pending.points.map(({ date, endDate }) => [date, endDate])).toEqual(active.points.map(({ date, endDate }) => [date, endDate]))
  expect(pending.points.reduce((sum, point) => sum + point.totalSales!, 0)).toBe(50)
})

it("never turns an unknown or missing legacy balance into zero", () => {
  const input = { data: [], dailyData: [], startDate: "2025-01-01", endDate: "2025-03-01",
    coverage: { startDate: "2025-01-01", endDate: "2025-03-01", complete: true } }
  const active = buildSalesTrend(input)
  expect(buildPendingSalesTrend(input, active).points.every(point => point.totalSales === null)).toBe(true)
  const pending = buildPendingSalesTrend({ ...input, dailyPendingData: [day("2025-01-01", 20), day("2025-01-02", null)] }, active)
  expect(pending.points[0].totalSales).toBeNull()
  expect(pending.points[1].totalSales).toBe(0)
})

it("does not spread a monthly pending total across an active daily series", () => {
  const input = { data: [], dailyData: [], startDate: "2025-01-01", endDate: "2025-01-31",
    pendingData: [{ month: "2025-01", onlineSales: 100, retailSales: 0, otherSales: 0, totalSales: 100 }],
    coverage: { startDate: "2025-01-01", endDate: "2025-01-31", complete: true } }
  expect(buildPendingSalesTrend(input, buildSalesTrend(input)).points.every(point => point.totalSales === null)).toBe(true)
})

it("supports legacy monthly pending while preserving an explicitly unknown total", () => {
  const input = { data: [{ month: "2025-01", onlineSales: 100, retailSales: 0 }],
    pendingData: [{ month: "2025-01", onlineSales: 20, retailSales: 0, otherSales: 0, totalSales: null }] }
  expect(buildPendingSalesTrend(input, buildSalesTrend(input)).points[0].totalSales).toBeNull()
})