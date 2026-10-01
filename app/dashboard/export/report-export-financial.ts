import { marketingFromCategories, overheadFromCategories } from "@/lib/costs/aggregate-costs"
import { costEfficiency, percentChange, type CostData, type CostRevenueData } from "@/app/components/dashboard/cost-report-data"
import { categorySchema, comparisonSchema, fields, periodSchema, record, type ExportSchema } from "./report-export-projection"

const channelAmounts = fields("onlineSales", "retailSales", "otherSales", "totalSales")
const summaryAmounts = fields("totalSales")
const financialSummary: ExportSchema = {
  receipts: comparisonSchema, refunds: comparisonSchema, netCollected: comparisonSchema,
  outstanding: fields("amount", "saleCount", "unknownSaleCount"),
  paymentStatus: Object.fromEntries(["paid", "partial", "unpaid", "unknown"].map(key => [key, fields("count", "amount")])),
  excluded: fields("count", "amount"), cashIssues: true,
}

export const financialMetadata: ExportSchema = {
  ...periodSchema, categoriesIncluded: true, days: true,
  trendCoverage: fields("startDate", "endDate", "complete"),
}
const common = {
  ...fields("currency", "periodType", "noData"), availableCurrencies: [true], metadata: financialMetadata,
} satisfies Record<string, ExportSchema>

export function salesSchema(section: string): ExportSchema {
  const base = { ...common, totalSales: comparisonSchema, transactions: comparisonSchema }
  if (section === "categories") return { ...base, salesCategories: [categorySchema] }
  const amounts = section === "channels" ? channelAmounts : summaryAmounts
  return {
    ...base,
    ...(section === "summary" ? { averageOrderValue: comparisonSchema, financialSummary } : {}),
    ...(section === "channels" ? {
      channelSales: Object.fromEntries(["online", "retail", "other"].map(key => [key, fields("amount", "prevAmount", "percentChange")])),
      salesDistribution: [fields("category", "percentage", "amount")] as const,
    } : {}),
    monthlyData: [{ month: true, ...amounts }], dailyData: [{ date: true, ...amounts }],
    monthlyPendingData: [{ month: true, ...amounts }], dailyPendingData: [{ date: true, ...amounts }],
  }
}

export const overviewRevenueSchema: ExportSchema = {
  ...common, totalSales: comparisonSchema,
  monthlyData: [{ month: true, ...summaryAmounts }], dailyData: [{ date: true, ...summaryAmounts }],
  monthlyPendingData: [{ month: true, ...summaryAmounts }], dailyPendingData: [{ date: true, ...summaryAmounts }],
}

export function costSchema(section: string): ExportSchema {
  return section === "categories" ? { ...common, costCategories: [categorySchema] } : {
    ...common, totalCosts: comparisonSchema,
    monthlyData: [fields("month", "fixedCosts", "variableCosts")],
    costDistribution: [fields("category", "percentage", "amount")],
    kpis: { total: comparisonSchema, marketing: categorySchema, overhead: categorySchema,
      efficiency: fields("ratio", "change", "reason") },
  }
}

export const costRevenueSchema: ExportSchema = { ...common, totalSales: comparisonSchema }

/** Category comparisons use the UI's baseline checks, not the API's fallback percentage. */
export function costCategoriesData(data: unknown): unknown {
  const source = record(data)
  return { ...source, costCategories: Array.isArray(source.costCategories) ? source.costCategories.map(row => {
    const category = record(row)
    return { ...category, percentChange: typeof category.amount === "number"
      ? percentChange(category.amount, typeof category.prevAmount === "number" ? category.prevAmount : null) : null }
  }) : source.costCategories }
}

/** Use the exact shared UI helpers; missing inputs must never become zero costs. */
export function costSummary(data: unknown, sales: unknown, campaignId = "all"): unknown {
  const source = record(data)
  const total = record(source.totalCosts)
  const categories = source.costCategories
  const validTotal = typeof total.actual === "number" && Number.isFinite(total.actual)
  const validCategories = Array.isArray(categories) && categories.every(row => {
    const item = record(row)
    return typeof item.name === "string" && [item.amount, item.prevAmount, item.percentChange]
      .every(value => typeof value === "number" && Number.isFinite(value))
  })
  const costs = validTotal && validCategories ? source as unknown as CostData : undefined
  const revenue = record(sales)
  const revenueTotal = record(revenue.totalSales)
  const salesData = typeof revenueTotal.actual === "number" && Number.isFinite(revenueTotal.actual)
    ? revenue as unknown as CostRevenueData : undefined
  const marketing = costs ? marketingFromCategories(costs.costCategories) : null
  const overhead = costs ? overheadFromCategories(costs.costCategories) : null
  const efficiency = costEfficiency(costs, salesData, campaignId)
  return { ...source, kpis: {
    total: costs ? { ...costs.totalCosts, percentChange: percentChange(costs.totalCosts.actual, costs.totalCosts.previous) } : null,
    marketing: marketing ? { ...marketing, percentChange: percentChange(marketing.amount, marketing.prevAmount) } : null,
    overhead: overhead ? { name: "Overhead", ...overhead, percentChange: percentChange(overhead.amount, overhead.prevAmount) } : null,
    efficiency: { ...efficiency, reason: efficiency.ratio === null || efficiency.change === null ? efficiency.reason : null },
  } }
}