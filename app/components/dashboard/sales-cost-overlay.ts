import type { OverviewPeriodCosts } from "@/lib/sales/report-types"
import { shiftDay } from "@/lib/sales/report-period"
import type { SalesPaymentStackPoint } from "./sales-payment-stack"
import { salesTrendDay } from "./sales-trend-data"

export type SalesCostOverlayPoint = SalesPaymentStackPoint & {
  expenses: number | null
  purchases: number | null
}

/** Reuse the sales buckets, including clipped edge weeks/months; never smooth the amounts. */
export function buildSalesCostOverlay(
  points: SalesPaymentStackPoint[], costs: OverviewPeriodCosts | undefined, currency: string,
): SalesCostOverlayPoint[] {
  const rows = new Map<string, { expenses: number | null; purchases: number | null }>()
  const coverageStart = salesTrendDay(costs?.coverage.startDate)
  const coverageEnd = salesTrendDay(costs?.coverage.endDate)
  const complete = costs?.coverage.complete === true && !!coverageStart && !!coverageEnd && coverageStart <= coverageEnd
  if (costs?.currency === currency) {
    for (const row of costs.dailyData) {
      const date = salesTrendDay(row.date)
      if (!date) continue
      rows.set(date, rows.has(date) ? { expenses: null, purchases: null } : row)
    }
  }
  return points.map(point => {
    const totals: { expenses: number | null; purchases: number | null } = { expenses: 0, purchases: 0 }
    if (!salesTrendDay(point.date) || !salesTrendDay(point.endDate) || costs?.currency !== currency) {
      return { ...point, expenses: null, purchases: null }
    }
    for (let day = point.date; day <= point.endDate; day = shiftDay(day, 1)) {
      const row = rows.get(day)
      const covered = complete && day >= coverageStart! && day <= coverageEnd!
      for (const key of ["expenses", "purchases"] as const) {
        const value = row ? row[key] : covered ? 0 : null
        if (typeof value !== "number" || !Number.isFinite(value)) totals[key] = null
        else if (totals[key] !== null) totals[key] += Math.round(value * 100)
      }
    }
    return { ...point, expenses: totals.expenses === null ? null : totals.expenses / 100,
      purchases: totals.purchases === null ? null : totals.purchases / 100 }
  })
}