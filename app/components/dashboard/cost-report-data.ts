export interface CostData {
  totalCosts: { actual: number; previous?: number | null }
  costCategories: Array<{ name: string; amount: number; prevAmount: number; percentChange: number }>
  monthlyData: Array<{ month: string; fixedCosts: number; variableCosts: number }>
  costDistribution: Array<{ category: string; percentage: number; amount: number }>
  currency?: string | null
  availableCurrencies?: string[]
  metadata?: {
    startDate?: string
    endDate?: string
    prevStartDate?: string
    prevEndDate?: string
    days?: number
  }
  noData?: boolean
}

export interface CostRevenueData {
  totalSales: { actual: number; previous?: number | null }
  currency?: string | null
}

export function percentChange(actual: number, previous: number | null | undefined): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(previous) || !previous || previous < 0) return null
  const change = (actual - previous) / previous * 100
  return Number.isFinite(change) ? change : null
}

export function costCurrency(currency?: string | null): string | null {
  return currency && /^[A-Z]{3}$/.test(currency) ? currency : null
}

export function formatCost(amount: number, currency?: string | null): string {
  if (!Number.isFinite(amount)) return "Unavailable"
  const code = costCurrency(currency)
  return new Intl.NumberFormat("en-US", {
    ...(code ? { style: "currency", currency: code } : {}),
    maximumFractionDigits: 2,
  }).format(amount)
}

export function costEfficiency(costs?: CostData, sales?: CostRevenueData, campaignId = "all") {
  const unavailable = (reason: string) => ({ ratio: null, change: null, reason })
  if (!costs || !sales) return unavailable("Sales data is unavailable.")
  if (campaignId !== "all") return unavailable("Sales and costs do not share the selected campaign scope.")
  if (!Number.isFinite(costs.totalCosts.actual) || costs.totalCosts.actual <= 0) {
    return unavailable("A ratio requires positive costs for the selected period.")
  }
  const currency = costCurrency(costs.currency)
  if (!currency || currency !== costCurrency(sales.currency)) {
    return unavailable("Matching sales and cost currencies are not established.")
  }
  if (!Number.isFinite(sales.totalSales.actual) || sales.totalSales.actual < 0) return unavailable("Sales data is unavailable.")
  const ratio = sales.totalSales.actual / costs.totalCosts.actual
  if (!Number.isFinite(ratio)) return unavailable("The sales-to-cost ratio is unavailable.")
  const previousCosts = costs.totalCosts.previous
  const previousSales = sales.totalSales.previous
  const previousRatio = Number.isFinite(previousCosts) && previousCosts! > 0 &&
    Number.isFinite(previousSales) && previousSales! > 0 ? previousSales! / previousCosts! : null
  return { ratio, change: percentChange(ratio, previousRatio), reason: "No previous baseline" }
}