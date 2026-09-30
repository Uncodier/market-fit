import type { SalesTrend, SalesTrendBucket } from "./sales-trend-data"

export type SalesPaymentStackPoint = SalesTrendBucket & {
  settledOnline: number | null
  settledRetail: number | null
  settledOther: number | null
  settledTotal: number | null
  pendingTotal: number | null
  unclassifiedTotal: number | null
}

const unknown = {
  settledOnline: null, settledRetail: null, settledOther: null, settledTotal: null, pendingTotal: null,
}
const keys = ["onlineSales", "retailSales", "otherSales", "totalSales"] as const
const cents = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) && value >= 0 &&
  Number.isSafeInteger(Math.round(value * 100)) ? Math.round(value * 100) : null

/** Pending is part of active sales, never an extra amount stacked on their full value. */
export function buildSalesPaymentStack(active: SalesTrend, pending: SalesTrend): SalesPaymentStackPoint[] {
  const byDate = new Map(pending.points.map(point => [point.date, point]))
  return active.points.map(point => {
    const balance = byDate.get(point.date)
    const amounts = keys.map(key => cents(point[key]))
    const balances = keys.map(key => cents(balance?.[key]))
    const valid = balance?.endDate === point.endDate && amounts.every((amount, i) =>
      amount !== null && balances[i] !== null && balances[i]! <= amount)
    if (!valid || amounts[0]! + amounts[1]! + amounts[2]! !== amounts[3] ||
      balances[0]! + balances[1]! + balances[2]! !== balances[3]) {
      return { ...point, ...unknown, unclassifiedTotal: point.totalSales }
    }
    return {
      ...point,
      settledOnline: (amounts[0]! - balances[0]!) / 100,
      settledRetail: (amounts[1]! - balances[1]!) / 100,
      settledOther: (amounts[2]! - balances[2]!) / 100,
      settledTotal: (amounts[3]! - balances[3]!) / 100,
      pendingTotal: balances[3]! / 100,
      unclassifiedTotal: null,
    }
  })
}