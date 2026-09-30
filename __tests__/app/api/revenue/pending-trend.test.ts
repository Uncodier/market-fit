import { buildSalesReport } from "@/app/api/revenue/build-sales-report"
import type { ReportSale } from "@/app/api/sales/sales-query"
import { salesReportPeriod } from "@/lib/sales/report-period"

const sale = (id: string, date: string, due: number | null, source = "shop", extra: Partial<ReportSale> = {}): ReportSale => ({
  id, sale_date: date, created_at: `${date}T12:00:00Z`, amount: 100, amount_due: due,
  payments: due === null || due === 100 ? [] : [{ amount: 100 - due, date }],
  currency: "USD", source, status: "pending", ...extra,
})
const period = salesReportPeriod(new URLSearchParams({ startDate: "2025-01-30", endDate: "2025-02-02" }))
const build = (rows: ReportSale[]) => buildSalesReport({ from: jest.fn(() => { throw new Error("Unexpected query") }) }, rows, period,
  { currency: "USD", segmentId: "all", includeCategories: false })

it("groups validated pending balances by the same sale dates/channels and reconciles with the summary", async () => {
  const result = await build([
    sale("online", "2025-01-30", 80), sale("retail", "2025-01-30", 40, "pos"),
    sale("unpaid", "2025-02-02", 100, "quote", { sale_date: null }), sale("paid", "2025-02-02", 0),
    sale("before", "2025-01-29", 100), sale("after", "2025-02-03", 100),
    sale("cancelled", "2025-01-30", 100, "shop", { status: "cancelled" }),
    sale("order", "2025-01-30", 100, "shop", { order_statuses: ["cancelled"] }),
    sale("refunded", "2025-01-30", 100, "shop", { status: "refunded" }),
    sale("eur", "2025-01-30", 100, "shop", { currency: "EUR" }),
  ])
  expect(result.dailyPendingData).toEqual([
    { date: "2025-01-30", onlineSales: 80, retailSales: 40, otherSales: 0, totalSales: 120 },
    { date: "2025-01-31", onlineSales: 0, retailSales: 0, otherSales: 0, totalSales: 0 },
    { date: "2025-02-01", onlineSales: 0, retailSales: 0, otherSales: 0, totalSales: 0 },
    { date: "2025-02-02", onlineSales: 0, retailSales: 0, otherSales: 100, totalSales: 100 },
  ])
  expect(result.monthlyPendingData).toEqual([
    { month: "2025-01", onlineSales: 80, retailSales: 40, otherSales: 0, totalSales: 120 },
    { month: "2025-02", onlineSales: 0, retailSales: 0, otherSales: 100, totalSales: 100 },
  ])
  expect(result.financialSummary?.outstanding.amount).toBe(220)
  expect(result.totalSales.actual).toBe(400)
})

it("does not publish a partial stacked column when any balance in its bucket is unknown", async () => {
  const result = await build([sale("known", "2025-01-30", 80), sale("unknown", "2025-01-30", null, "pos"),
    sale("later", "2025-02-02", 20)])
  expect(result.dailyPendingData?.[0]).toEqual({ date: "2025-01-30", onlineSales: null, retailSales: null, otherSales: null, totalSales: null })
  expect(result.dailyPendingData?.[3].totalSales).toBe(20)
  expect(result.monthlyPendingData?.map(point => point.totalSales)).toEqual([null, 20])
  expect(result.financialSummary?.outstanding.amount).toBeNull()
})

it("keeps current debt distinct from cash in a historical period and uses exact cents", async () => {
  const result = await build([
    sale("paid-later", "2025-01-30", 0, "shop", { payments: [{ amount: 100, date: "2025-03-01" }] }),
    sale("decimal-a", "2025-01-30", 0.1, "shop", { amount: 0.1, payments: [] }),
    sale("decimal-b", "2025-01-30", 0.2, "pos", { amount: 0.2, payments: [] }),
  ])
  expect(result.dailyPendingData?.[0].totalSales).toBe(0.3)
  expect(result.financialSummary?.receipts?.actual).toBe(0)
})

it("returns complete zero pending days for an empty successful report", async () => {
  const result = await build([])
  expect(result.dailyPendingData).toHaveLength(4)
  expect(result.dailyPendingData?.every(point => point.totalSales === 0)).toBe(true)
})