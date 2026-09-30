import {
  aggregateByCategory, buildCostCategories, buildCostDistribution, buildMonthlyCostData,
  costRowsInRange, parseTransactionDate, percentChangeFrom, periodTypeFromDays, sumCosts,
  type CostTransaction,
} from "@/lib/costs/aggregate-costs"
import type { CostReportInput } from "./cost-input"

export function buildCostReport(
  rows: CostTransaction[], currency: string | null, input: CostReportInput, availableCurrencies: string[],
) {
  const current = costRowsInRange(rows, input.start, input.end)
  const previous = costRowsInRange(rows, input.previousStart, input.previousEnd)
  const monthly = costRowsInRange(rows, input.monthlyStart, input.end)
  const actual = sumCosts(current)
  const previousTotal = sumCosts(previous)
  const categories = aggregateByCategory(current)
  const previousCategories = aggregateByCategory(previous)
  const costDistribution = buildCostDistribution(categories, actual)
  // Keep previous-only categories without changing the shared helper's semantics.
  for (const name of previousCategories.keys()) {
    if (!categories.has(name)) categories.set(name, 0)
  }
  return {
    totalCosts: {
      actual, previous: previousTotal, percentChange: percentChangeFrom(previousTotal, actual),
      formattedActual: actual.toLocaleString("en-US"),
      formattedPrevious: previousTotal.toLocaleString("en-US"),
    },
    costCategories: buildCostCategories(categories, previousCategories),
    monthlyData: buildMonthlyCostData(
      monthly.map((row) => ({ ...row, date: row.date.slice(0, 10) })), 6, parseTransactionDate(input.end),
    ),
    costDistribution,
    currency,
    availableCurrencies,
    periodType: periodTypeFromDays(input.days),
    noData: current.length === 0,
    metadata: {
      startDate: `${input.start}T00:00:00.000Z`,
      endDate: `${input.end}T00:00:00.000Z`,
      prevStartDate: `${input.previousStart}T00:00:00.000Z`,
      prevEndDate: `${input.previousEnd}T00:00:00.000Z`,
      endExclusive: input.endExclusive,
      days: input.days,
      segmentId: input.segmentId,
      campaignId: input.campaignId,
      dateBasis: "calendar-date",
      currencyBasis: currency === "UNSPECIFIED" ? "unspecified-currency-bucket" : "stored-currency-no-conversion",
    },
  }
}