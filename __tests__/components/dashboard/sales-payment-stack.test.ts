import { buildPendingSalesTrend, buildSalesTrend } from "@/app/components/dashboard/sales-trend-data"
import { buildSalesPaymentStack } from "@/app/components/dashboard/sales-payment-stack"
import type { SalesPendingDailyTrendPoint } from "@/lib/sales/report-types"

const activeDay = { date: "2025-01-01", onlineSales: 100, retailSales: 50, otherSales: 25, totalSales: 175 }
const pendingDay = { ...activeDay, onlineSales: 80, retailSales: 10, otherSales: 0, totalSales: 90 }
const input = { data: [], dailyData: [activeDay], startDate: "2025-01-01", endDate: "2025-01-02",
  coverage: { startDate: "2025-01-01", endDate: "2025-01-02", complete: true } }

function stack(dailyPendingData: SalesPendingDailyTrendPoint[] | undefined, overrides = {}) {
  const source = { ...input, ...overrides }
  const active = buildSalesTrend(source)
  return buildSalesPaymentStack(active, buildPendingSalesTrend({ ...source, dailyPendingData }, active))
}

it("subtracts pending from the lower segments so one stack equals the active total", () => {
  const points = stack([pendingDay])
  expect(points[0]).toMatchObject({ settledOnline: 20, settledRetail: 40, settledOther: 25, settledTotal: 85,
    pendingTotal: 90, totalSales: 175, unclassifiedTotal: null })
  expect(points[0].settledTotal! + points[0].pendingTotal!).toBe(points[0].totalSales)
  expect(points[1]).toMatchObject({ settledTotal: 0, pendingTotal: 0, totalSales: 0 })
})

it("keeps fully unpaid and fully settled periods at their original sale value", () => {
  expect(stack([activeDay])[0]).toMatchObject({ settledTotal: 0, pendingTotal: 175, totalSales: 175 })
  expect(stack([{ ...activeDay, onlineSales: 0, retailSales: 0, otherSales: 0, totalSales: 0 }])[0])
    .toMatchObject({ settledTotal: 175, pendingTotal: 0, totalSales: 175 })
})

it.each([
  undefined,
  [{ ...pendingDay, totalSales: null }],
  [{ ...pendingDay, onlineSales: 110, totalSales: 120 }],
  [{ ...pendingDay, onlineSales: -1 }],
  [{ ...pendingDay, totalSales: 99 }],
  [pendingDay, pendingDay],
])("preserves active value without inventing the payment split for %j", dailyPendingData => {
  expect(stack(dailyPendingData)[0]).toMatchObject({
    totalSales: 175, settledTotal: null, pendingTotal: null, unclassifiedTotal: 175,
  })
})

it("uses identical weekly and monthly boundaries, including partial final periods", () => {
  for (const endDate of ["2025-02-20", "2025-08-03"]) {
    const source = { ...input, endDate, coverage: { ...input.coverage, endDate },
      dailyData: [activeDay, { ...activeDay, date: endDate }] }
    const active = buildSalesTrend(source)
    const pending = buildPendingSalesTrend({ ...source, dailyPendingData: [pendingDay, { ...pendingDay, date: endDate }] }, active)
    const points = buildSalesPaymentStack(active, pending)
    expect(pending.granularity).toBe(active.granularity)
    expect(points[0].pendingTotal).toBe(90)
    expect(points.at(-1)).toMatchObject({ endDate, pendingTotal: 90, settledTotal: 85, totalSales: 175 })
    expect(points.reduce((sum, point) => sum + point.pendingTotal!, 0)).toBe(180)
  }
})

it("does not draw a partial weekly split when one daily balance is unknown", () => {
  const endDate = "2025-03-01"
  const points = stack([{ ...pendingDay, totalSales: null }], { endDate, coverage: { ...input.coverage, endDate } })
  expect(points[0]).toMatchObject({ totalSales: 175, settledTotal: null, pendingTotal: null, unclassifiedTotal: 175 })
  expect(points[1]).toMatchObject({ totalSales: 0, pendingTotal: 0 })
})

it("does not infer daily pending from monthly data or treat explicit monthly null as zero", () => {
  const active = buildSalesTrend(input)
  const pending = buildPendingSalesTrend({ ...input, pendingData: [{ month: "2025-01", onlineSales: 80, retailSales: 10, otherSales: 0, totalSales: 90 }] }, active)
  expect(buildSalesPaymentStack(active, pending)[0].pendingTotal).toBeNull()
  const legacy = buildSalesTrend({ data: [{ month: "2025-01", onlineSales: 100, retailSales: 0, totalSales: 100 }] })
  const legacyPending = buildPendingSalesTrend({ data: [], pendingData: [{ month: "2025-01", onlineSales: null, retailSales: null, otherSales: null, totalSales: null }] }, legacy)
  expect(buildSalesPaymentStack(legacy, legacyPending)[0]).toMatchObject({ pendingTotal: null, unclassifiedTotal: 100 })
})

it("uses cents for the settled portion instead of floating point subtraction artifacts", () => {
  const source = { ...input, dailyData: [{ ...activeDay, onlineSales: 0.3, retailSales: 0, otherSales: 0, totalSales: 0.3 }] }
  expect(stack([{ ...pendingDay, onlineSales: 0.1, retailSales: 0, otherSales: 0, totalSales: 0.1 }], source)[0])
    .toMatchObject({ settledTotal: 0.2, pendingTotal: 0.1 })
})