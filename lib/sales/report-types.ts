export type SalesReportSection = "summary" | "channels" | "categories"
export type SalesMetric = { actual: number; previous: number; percentChange: number | null }
export type SalesCategory = { name: string; amount: number; prevAmount: number; percentChange: number | null }
export type SalesChannelAmounts = {
  onlineSales: number
  retailSales: number
  otherSales: number
  totalSales: number
}
export type SalesTrendPoint = SalesChannelAmounts & { month: string }
export type SalesDailyTrendPoint = SalesChannelAmounts & { date: string }
export type SalesTrendCoverage = {
  startDate: string
  endDate: string
  complete: boolean
}

export interface SalesReportData {
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