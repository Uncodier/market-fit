"use client"

import { useOverviewSlice } from "@/app/hooks/use-dashboard-batches"
import { MonthlySalesEvolutionChart } from "@/app/components/dashboard/monthly-sales-evolution-chart"
import type { SalesReportData } from "@/lib/sales/report-types"

export function OverviewSalesTrend({ startDate, endDate, segmentId }: {
  startDate: Date
  endDate: Date
  segmentId: string
}) {
  const { data, isLoading } = useOverviewSlice<SalesReportData>("revenue", startDate, endDate, segmentId)
  return <MonthlySalesEvolutionChart data={data?.monthlyData ?? []} currency={data?.currency}
    dailyData={data?.dailyData} startDate={startDate} endDate={endDate} coverage={data?.metadata?.trendCoverage}
    isLoading={isLoading} dataReady={!!data} byChannel={false} showPeriod={false} />
}