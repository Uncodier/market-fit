import { sumCents } from "@/app/accounting/posting-core"
import { isRecognizedRevenueSale } from "@/lib/sales/recognized-sale"
import { shiftDay } from "@/lib/sales/report-period"
import type { SalesPendingAmounts } from "@/lib/sales/report-types"
import type { SaleLedger } from "./payment-ledger"
import { isOnlineSource, isRetailSource, saleCalendarDate } from "./revenue-aggregations"

const zero = (): SalesPendingAmounts => ({ onlineSales: 0, retailSales: 0, otherSales: 0, totalSales: 0 })
const missing = (): SalesPendingAmounts => ({ onlineSales: null, retailSales: null, otherSales: null, totalSales: null })

/** Reuse validated, currency-scoped balances; never infer historical debt or query per bucket. */
export function buildPendingTrend(ledgers: SaleLedger[], start: string, end: string) {
  const daily = new Map<string, SalesPendingAmounts>()
  const monthly = new Map<string, SalesPendingAmounts>()
  for (let day = start; day <= end; day = shiftDay(day, 1)) {
    daily.set(day, zero())
    if (!monthly.has(day.slice(0, 7))) monthly.set(day.slice(0, 7), zero())
  }
  for (const { sale, due } of ledgers) {
    const date = saleCalendarDate(sale)
    if (!isRecognizedRevenueSale(sale) || date < start || date > end) continue
    const channel = isOnlineSource(sale.source) ? "onlineSales" : isRetailSource(sale.source) ? "retailSales" : "otherSales"
    for (const [buckets, key] of [[daily, date], [monthly, date.slice(0, 7)]] as const) {
      const bucket = buckets.get(key)!
      // An unknown balance must not appear as a complete, smaller stacked column.
      if (due === null) buckets.set(key, missing())
      else if (bucket.totalSales !== null) {
        bucket[channel] = sumCents([bucket[channel]!, due])
        bucket.totalSales = sumCents([bucket.totalSales, due])
      }
    }
  }
  const money = (amounts: SalesPendingAmounts): SalesPendingAmounts => ({
    onlineSales: amounts.onlineSales === null ? null : amounts.onlineSales / 100,
    retailSales: amounts.retailSales === null ? null : amounts.retailSales / 100,
    otherSales: amounts.otherSales === null ? null : amounts.otherSales / 100,
    totalSales: amounts.totalSales === null ? null : amounts.totalSales / 100,
  })
  return {
    dailyPendingData: Array.from(daily, ([date, amounts]) => ({ date, ...money(amounts) })),
    monthlyPendingData: Array.from(monthly, ([month, amounts]) => ({ month, ...money(amounts) })),
  }
}