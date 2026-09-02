"use client"

import { useMemo } from "react"
import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { useSite } from "@/app/context/SiteContext"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { BarChart } from "@/app/components/ui/icons"
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget"
import { CostDistributionChart } from "@/app/components/dashboard/cost-distribution-chart"
import { MonthlyCostEvolutionChart } from "@/app/components/dashboard/monthly-cost-evolution-chart"
import { CostBreakdownReport } from "@/app/components/dashboard/cost-breakdown-report"
import { format, subDays } from "date-fns"
import {
  efficiencyRatio,
  marketingFromCategories,
  overheadFromCategories,
} from "@/lib/costs/aggregate-costs"

interface CostData {
  totalCosts: {
    actual: number
    previous: number
    percentChange: number
    formattedActual: string
    formattedPrevious: string
  }
  costCategories: Array<{
    name: string
    amount: number
    prevAmount: number
    percentChange: number
  }>
  monthlyData: Array<{
    month: string
    fixedCosts: number
    variableCosts: number
  }>
  costDistribution: Array<{
    category: string
    percentage: number
    amount: number
  }>
  periodType?: string
  noData?: boolean
}

interface RevenueData {
  totalSales?: {
    actual: number
    previous: number
  }
  noData?: boolean
}

const emptyData: CostData = {
  totalCosts: {
    actual: 0,
    previous: 0,
    percentChange: 0,
    formattedActual: "0",
    formattedPrevious: "0",
  },
  costCategories: [],
  monthlyData: [],
  costDistribution: [],
  noData: true,
}

interface CostReportsProps {
  startDate?: Date
  endDate?: Date
  segmentId?: string
  campaignId?: string
}

function formatPeriodType(periodType?: string): string {
  switch (periodType) {
    case "daily":
      return "yesterday"
    case "weekly":
      return "last week"
    case "monthly":
      return "last month"
    case "quarterly":
      return "last quarter"
    case "yearly":
      return "last year"
    default:
      return "previous period"
  }
}

function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return "$0"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

async function fetchJson(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error("Failed to fetch cost data")
  }
  return response.json()
}

export function CostReports({
  startDate: propStartDate,
  endDate: propEndDate,
  segmentId = "all",
  campaignId = "all",
}: CostReportsProps) {
  const { currentSite } = useSite()
  const startDate = propStartDate || subDays(new Date(), 30)
  const endDate = propEndDate || new Date()

  const siteId = currentSite?.id === "default" ? null : currentSite?.id
  const dateQuery = `startDate=${format(startDate, "yyyy-MM-dd")}&endDate=${format(endDate, "yyyy-MM-dd")}`
  const filterQuery = `${segmentId !== "all" ? `&segmentId=${segmentId}` : ""}${
    campaignId !== "all" ? `&campaignId=${campaignId}` : ""
  }&useDemoData=true`
  const costsUrl = siteId ? `/api/costs?siteId=${siteId}&${dateQuery}${filterQuery}` : null
  const revenueUrl = siteId ? `/api/revenue?siteId=${siteId}&${dateQuery}${
    segmentId !== "all" ? `&segmentId=${segmentId}` : ""
  }` : null

  const { data: fetchedCostData, isLoading: isLoadingCosts } = useSWR<CostData>(
    costsUrl,
    fetchJson
  )
  const { data: fetchedRevenueData, isLoading: isLoadingRevenue } = useSWR<RevenueData>(
    revenueUrl,
    fetchJson
  )

  const isLoading = isLoadingCosts
  const isEfficiencyLoading = isLoadingCosts || (!!revenueUrl && isLoadingRevenue && !fetchedRevenueData)
  const dataReady = !!fetchedCostData || !siteId
  const costData = fetchedCostData || emptyData
  const hasData = fetchedCostData ? !fetchedCostData.noData : false
  const hasDistributionData = hasData && costData.costDistribution.length > 0
  const hasMonthlyData = costData.monthlyData.some(
    (row) => row.fixedCosts > 0 || row.variableCosts > 0
  )
  const hasCategoriesData = hasData && costData.costCategories.length > 0
  const periodLabel = formatPeriodType(costData.periodType)

  const kpis = useMemo(() => {
    const marketing = marketingFromCategories(costData.costCategories)
    const overhead = overheadFromCategories(costData.costCategories)
    const currentRevenue = fetchedRevenueData?.totalSales?.actual || 0
    const prevRevenue = fetchedRevenueData?.totalSales?.previous || 0
    const currentRatio = efficiencyRatio(currentRevenue, costData.totalCosts?.actual || 0)
    const prevRatio = efficiencyRatio(prevRevenue, costData.totalCosts?.previous || 0)
    const ratioChange =
      prevRatio > 0 ? ((currentRatio - prevRatio) / prevRatio) * 100 : currentRatio > 0 ? 100 : 0

    return { marketing, overhead, currentRatio, ratioChange }
  }, [costData, fetchedRevenueData])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <BaseKpiWidget
          title="Total Costs"
          value={hasData ? `$${costData.totalCosts.formattedActual}` : "$0"}
          changeText={hasData ? `${costData.totalCosts.percentChange.toFixed(1)}% from ${periodLabel}` : "No data available"}
          isPositiveChange={hasData ? costData.totalCosts.percentChange < 0 : undefined}
          isLoading={isLoading}
          startDate={startDate}
          endDate={endDate}
        />
        <BaseKpiWidget
          title="Marketing Costs"
          value={formatCurrency(kpis.marketing.amount)}
          changeText={hasData ? `${kpis.marketing.percentChange.toFixed(1)}% from ${periodLabel}` : "No data available"}
          isPositiveChange={hasData ? kpis.marketing.percentChange < 0 : undefined}
          isLoading={isLoading}
          startDate={startDate}
          endDate={endDate}
        />
        <BaseKpiWidget
          title="Efficiency Ratio"
          value={`${(kpis.currentRatio || 0).toFixed(1)}:1`}
          changeText={hasData ? `${kpis.ratioChange.toFixed(1)}% from ${periodLabel}` : "No data available"}
          isPositiveChange={hasData ? kpis.ratioChange > 0 : undefined}
          isLoading={isEfficiencyLoading}
          startDate={startDate}
          endDate={endDate}
        />
        <BaseKpiWidget
          title="Overhead Costs"
          value={formatCurrency(kpis.overhead.amount)}
          changeText={hasData ? `${kpis.overhead.percentChange.toFixed(1)}% from ${periodLabel}` : "No data available"}
          isPositiveChange={hasData ? kpis.overhead.percentChange < 0 : undefined}
          isLoading={isLoading}
          startDate={startDate}
          endDate={endDate}
        />
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <CostDistributionChart
          data={hasDistributionData ? costData.costDistribution : []}
          isLoading={isLoading}
          dataReady={dataReady}
        />
        <MonthlyCostEvolutionChart
          data={hasMonthlyData ? costData.monthlyData : []}
          isLoading={isLoading}
          dataReady={dataReady}
        />
      </div>

      {isLoading || !dataReady ? (
        <Card>
          <CardHeader>
            <CardTitle>Cost Breakdown</CardTitle>
            <CardDescription>Detailed analysis of costs by category.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full space-y-6">
              <div className="flex justify-between items-center mb-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-8 w-24" />
              </div>
              <div className="space-y-4">
                {Array(3).fill(0).map((_, i) => (
                  <div key={`row-${i}`} className="grid grid-cols-7 gap-4 items-center py-3 border-b">
                    <div className="col-span-3">
                      <Skeleton className="h-5 w-32" />
                    </div>
                    <div className="col-span-1 text-right">
                      <Skeleton className="h-5 w-20 ml-auto" />
                    </div>
                    <div className="col-span-1 text-right">
                      <Skeleton className="h-5 w-20 ml-auto" />
                    </div>
                    <div className="col-span-1 text-center">
                      <Skeleton className="h-5 w-16 mx-auto" />
                    </div>
                    <div className="col-span-1 text-right">
                      <Skeleton className="h-8 w-8 ml-auto rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : hasCategoriesData ? (
        <CostBreakdownReport
          data={costData.costCategories}
          isLoading={isLoading}
          dataReady={dataReady}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Cost Breakdown</CardTitle>
            <CardDescription>Detailed analysis of costs by category.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyCard
              icon={<BarChart className="h-8 w-8 text-muted-foreground" />}
              title="No cost categories data"
              description="There is no cost breakdown data available for the selected period."
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
