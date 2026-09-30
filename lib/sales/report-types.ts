export type SalesReportSection = "summary" | "channels" | "categories"
export type SalesMetric = { actual: number; previous: number; percentChange: number | null }
export type SalesFinancialSummary = {
  receipts: SalesMetric | null
  refunds: SalesMetric | null
  netCollected: SalesMetric | null
  outstanding: { amount: number | null; saleCount: number; unknownSaleCount: number }
  paymentStatus: Record<"paid" | "partial" | "unpaid" | "unknown", { count: number; amount: number }>
  excluded: { count: number; amount: number }
  cashIssues: number
}
export type SalesCategory = { name: string; amount: number; prevAmount: number; percentChange: number | null }
export type SalesChannelAmounts = {
  onlineSales: number
  retailSales: number
  otherSales: number
  totalSales: number
}
export type SalesTrendPoint = SalesChannelAmounts & { month: string }
export type SalesDailyTrendPoint = SalesChannelAmounts & { date: string }
export type SalesPendingAmounts = { [Key in keyof SalesChannelAmounts]: number | null }
export type SalesPendingTrendPoint = SalesPendingAmounts & { month: string }
export type SalesPendingDailyTrendPoint = SalesPendingAmounts & { date: string }
export type SalesTrendCoverage = {
  startDate: string
  endDate: string
  complete: boolean
}

export interface SalesReportData {
  /** Absent only on older responses. Missing cash history is unavailable, never zero. */
  financialSummary?: SalesFinancialSummary
  totalSales: SalesMetric & { formattedActual: string; formattedPrevious: string }
  channelSales: Record<"online" | "retail" | "other", {
    amount: number; prevAmount: number; percentChange: number | null
  }>
  averageOrderValue: SalesMetric
  transactions: SalesMetric
  salesCategories: SalesCategory[]
  monthlyData: SalesTrendPoint[]
  /** Optional for compatibility with older revenue responses; never derived from monthly totals. */
  dailyData?: SalesDailyTrendPoint[]
  /** Current balances grouped by sale date, not historical closing balances or receipts. */
  monthlyPendingData?: SalesPendingTrendPoint[]
  dailyPendingData?: SalesPendingDailyTrendPoint[]
  salesDistribution: Array<{ category: string; percentage: number; amount: number }>
  currency: string
  availableCurrencies: string[]
  periodType: string
  noData: boolean
  metadata: {
    startDate: string
    endDate: string
    prevStartDate: string
    prevEndDate: string
    segmentId: string
    basis: string
    dateBasis: string
    categoriesIncluded: boolean
    /** Only a successful, complete row scan may declare missing days to be zero. */
    trendCoverage?: SalesTrendCoverage
  }
}