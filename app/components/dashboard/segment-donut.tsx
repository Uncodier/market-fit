"use client"

import { useEffect, useMemo } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { DistributionChart } from "./distribution-chart"
import { ReportState } from "./report-state"
import { distributionTotal, formatDistributionValue, reportPeriod } from "./report-query"
import { useDistributionReport } from "./use-distribution-report"
import { ReportChartLoading } from "./report-visual-loading"

interface SegmentDonutProps {
  showTotal?: boolean
  segmentId?: string
  startDate?: Date
  endDate?: Date
  onTotalUpdate?: (formattedTotal: string) => void
  endpoint: string
  formatValues?: boolean
  variant?: "default" | "compact"
}

export function SegmentDonut({ showTotal = false, segmentId = "all", startDate, endDate, onTotalUpdate, endpoint, formatValues = false, variant = "default" }: SegmentDonutProps) {
  const { currentSite, isLoading: siteLoading } = useSite()
  const { user, isLoading: authLoading } = useAuth()
  const start = startDate?.getTime()
  const end = endDate?.getTime()
  const period = useMemo(() => reportPeriod(
    start === undefined ? undefined : new Date(start),
    end === undefined ? undefined : new Date(end),
  ), [start, end])
  const { data, currency, error, isLoading, isValidating, mutate } = useDistributionReport({
    endpoint, userId: user?.id, siteId: currentSite?.id, segmentId, period, enabled: !authLoading && !siteLoading,
  })
  const total = data ? distributionTotal(data) : undefined
  const formattedTotal = total === undefined || error ? "—" : formatDistributionValue(total, formatValues ? currency : undefined)

  // A callback update can notify a new consumer without restarting a request.
  useEffect(() => { onTotalUpdate?.(formattedTotal) }, [formattedTotal, onTotalUpdate])

  if (authLoading || siteLoading || isLoading || isValidating) return <ReportChartLoading fitViewport={false} />
  if (!user?.id) return <ReportState state="error" message="Sign in to view this report." />
  if (!currentSite || currentSite.id === "default") return <ReportState state="empty" message="Select a site to view this report." />
  if (!period) return <ReportState state="error" message="Select a valid date range." />
  if (error) return <ReportState state="error" message={error.message} onRetry={() => { void mutate() }} />
  if (!data) return <ReportChartLoading fitViewport={false} />
  if (!total) return <ReportState state="empty" message="No data for the selected filters." />
  const title = endpoint.replaceAll("-", " ")
  return <DistributionChart data={data} title={title} showTotal={showTotal} formatValues={formatValues} currency={currency} variant={variant} />
}
