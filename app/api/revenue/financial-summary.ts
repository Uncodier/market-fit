import { cents, sumCents } from "@/app/accounting/posting-core"
import { isRecognizedRevenueSale } from "@/lib/sales/recognized-sale"
import { salesPercentChange } from "@/lib/sales/report-format"
import type { SalesFinancialSummary } from "@/lib/sales/report-types"
import type { SalesReportPeriod } from "@/lib/sales/report-period"
import { saleCalendarDate } from "./revenue-aggregations"
import type { CashMovement, SaleLedger } from "./payment-ledger"

export function ledgerInPeriod(ledger: SaleLedger, period: SalesReportPeriod): boolean {
  const date = saleCalendarDate(ledger.sale)
  return (date >= period.previousStart && date <= period.end) || ledger.receiptIssue || ledger.refundIssue ||
    [...ledger.receipts, ...ledger.refunds].some(movement => movement.date >= period.previousStart && movement.date <= period.end)
}

export function buildFinancialSummary(ledgers: SaleLedger[], period: SalesReportPeriod): SalesFinancialSummary {
  const totals = (movements: CashMovement[]) => {
    const amount = (start: string, end: string) => sumCents(movements
      .filter(movement => movement.date >= start && movement.date <= end).map(movement => movement.amount)) / 100
    return { actual: amount(period.start, period.end), previous: amount(period.previousStart, period.previousEnd) }
  }
  const metric = ({ actual, previous }: { actual: number; previous: number }) => ({
    actual, previous, percentChange: salesPercentChange(previous, actual),
  })
  const receipts = ledgers.some(ledger => ledger.receiptIssue) ? null : metric(totals(ledgers.flatMap(ledger => ledger.receipts)))
  const refunds = ledgers.some(ledger => ledger.refundIssue) ? null : metric(totals(ledgers.flatMap(ledger => ledger.refunds)))
  const paymentStatus = { paid: { count: 0, amount: 0 }, partial: { count: 0, amount: 0 },
    unpaid: { count: 0, amount: 0 }, unknown: { count: 0, amount: 0 } }
  let outstanding = 0, unknownSaleCount = 0, saleCount = 0, excludedAmount = 0, excludedCount = 0
  for (const { sale, due } of ledgers) {
    const date = saleCalendarDate(sale)
    if (date < period.start || date > period.end) continue
    const amount = cents(sale.amount, "Sale amount")
    if (!isRecognizedRevenueSale(sale)) {
      excludedAmount = sumCents([excludedAmount, amount])
      excludedCount++
      continue
    }
    saleCount++
    const status = due === null ? "unknown" : due === 0 ? "paid" : due === amount ? "unpaid" : "partial"
    paymentStatus[status].count++
    paymentStatus[status].amount = sumCents([paymentStatus[status].amount, amount])
    if (due === null) unknownSaleCount++
    else outstanding = sumCents([outstanding, due])
  }
  for (const value of Object.values(paymentStatus)) value.amount /= 100
  return {
    receipts, refunds,
    netCollected: receipts && refunds ? metric({
      actual: (Math.round(receipts.actual * 100) - Math.round(refunds.actual * 100)) / 100,
      previous: (Math.round(receipts.previous * 100) - Math.round(refunds.previous * 100)) / 100,
    }) : null,
    outstanding: { amount: unknownSaleCount ? null : outstanding / 100, saleCount, unknownSaleCount },
    paymentStatus, excluded: { count: excludedCount, amount: excludedAmount / 100 },
    cashIssues: ledgers.filter(ledger => ledger.receiptIssue || ledger.refundIssue).length,
  }
}