import type { ReportSale, SalesClient } from "@/app/api/sales/sales-query"
import type { SalesReportPeriod } from "@/lib/sales/report-period"
import type { SalesReportData, SalesMetric } from "@/lib/sales/report-types"
import { salesCurrency, salesPercentChange } from "@/lib/sales/report-format"
import { cents, sumCents } from "@/app/accounting/posting-core"
import { isRecognizedRevenueSale } from "@/lib/sales/recognized-sale"
import { salePaymentLedger } from "./payment-ledger"
import { buildFinancialSummary, ledgerInPeriod } from "./financial-summary"
import {
  aggregateSalesByCategory, buildDailyChannelData, buildMonthlyChannelData, getSalesAmount,
  isOnlineSource, isRetailSource, saleCalendarDate,
} from "./revenue-aggregations"

export class SalesCurrencyRequiredError extends Error {
  constructor(readonly availableCurrencies: string[]) {
    super("Sales use multiple currencies. Select a currency to view monetary totals.")
  }
}

const metric = (actual: number, previous: number): SalesMetric => ({
  actual, previous, percentChange: salesPercentChange(previous, actual),
})
const sum = (sales: ReportSale[]) => sumCents(sales.map(sale => cents(getSalesAmount(sale), "Sale amount"))) / 100

export async function buildSalesReport(
  client: SalesClient,
  sales: ReportSale[],
  period: SalesReportPeriod,
  options: { currency: string | null; siteCurrency?: unknown; segmentId: string; includeCategories: boolean },
): Promise<SalesReportData> {
  const ledgers = sales.map(salePaymentLedger).filter(ledger => ledgerInPeriod(ledger, period))
  const availableCurrencies = Array.from(new Set(ledgers.map(({ sale }) => salesCurrency(sale.currency)))).sort()
  if (!options.currency && availableCurrencies.length > 1) throw new SalesCurrencyRequiredError(availableCurrencies)
  // Site settings label empty reports only; never relabel recorded sale amounts.
  const currency = options.currency || availableCurrencies[0] || salesCurrency(options.siteCurrency)
  const scopedLedgers = ledgers.filter(({ sale }) => salesCurrency(sale.currency) === currency)
  const scoped = scopedLedgers.map(({ sale }) => sale).filter(sale => isRecognizedRevenueSale(sale) &&
    saleCalendarDate(sale) >= period.previousStart && saleCalendarDate(sale) <= period.end)
  const current = scoped.filter((sale) => saleCalendarDate(sale) >= period.start)
  const previous = scoped.filter((sale) => saleCalendarDate(sale) < period.start)
  const actual = sum(current)
  const prev = sum(previous)
  const channel = (rows: ReportSale[], key: string) => rows.filter((sale) =>
    (isOnlineSource(sale.source) ? "online" : isRetailSource(sale.source) ? "retail" : "other") === key)
  const channelMetric = (key: string) => {
    const amount = sum(channel(current, key))
    const prevAmount = sum(channel(previous, key))
    return { amount, prevAmount, percentChange: salesPercentChange(prevAmount, amount) }
  }
  const channelSales = { online: channelMetric("online"), retail: channelMetric("retail"), other: channelMetric("other") }
  const [categories, prevCategories] = options.includeCategories ? await Promise.all([
    aggregateSalesByCategory(client, current), aggregateSalesByCategory(client, previous),
  ]) : [new Map<string, number>(), new Map<string, number>()]
  const names = new Set([...categories.keys(), ...prevCategories.keys()])
  return {
    financialSummary: buildFinancialSummary(scopedLedgers, period),
    totalSales: { ...metric(actual, prev), formattedActual: String(actual), formattedPrevious: String(prev) },
    channelSales,
    transactions: metric(current.length, previous.length),
    averageOrderValue: metric(current.length ? actual / current.length : 0, previous.length ? prev / previous.length : 0),
    salesCategories: Array.from(names).map((name) => ({
      name, amount: categories.get(name) || 0, prevAmount: prevCategories.get(name) || 0,
      percentChange: salesPercentChange(prevCategories.get(name) || 0, categories.get(name) || 0),
    })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)),
    monthlyData: buildMonthlyChannelData(current, period.start, period.end),
    dailyData: buildDailyChannelData(current, period.start, period.end),
    salesDistribution: Object.entries(channelSales).map(([key, value]) => ({
      category: key === "other" ? "Other / unassigned" : key === "online" ? "Online" : "Retail",
      amount: value.amount, percentage: actual > 0 ? value.amount / actual * 100 : 0,
    })),
    currency, availableCurrencies, periodType: "custom", noData: current.length === 0,
    metadata: {
      startDate: period.start, endDate: period.end,
      trendCoverage: { startDate: period.start, endDate: period.end, complete: true },
      prevStartDate: period.previousStart, prevEndDate: period.previousEnd,
      segmentId: options.segmentId, categoriesIncluded: options.includeCategories,
      basis: "Active sale amounts (pending and completed), regardless of payment. Cancelled/refunded sales and sales linked to any cancelled order are excluded. Net collected uses dated receipts less recorded refunds, including cancelled sales, on each movement's UTC date.",
      dateBasis: "Inclusive sale dates; UTC created date is used only when the sale date is missing.",
    },
  }
}