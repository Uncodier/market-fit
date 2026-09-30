"use client"

import type { ReactNode } from "react"
import { Button } from "@/app/components/ui/button"
import { useDashboardOverview, useDashboardPerformance } from "@/app/hooks/use-dashboard-batches"
import { ReportLoading, useReportLoadingSelection } from "./ReportLoading"
import { useReportDataContext } from "./ReportDataContext"

type Props = { startDate: Date; endDate: Date; segmentId: string; children: ReactNode }

function BatchError({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border bg-background p-6 space-y-3">
      <h2 className="font-semibold">Unable to load report metrics</h2>
      <p className="text-sm text-muted-foreground">The data could not be refreshed. Missing metrics are not zero activity.</p>
      <Button variant="outline" onClick={retry}>Try again</Button>
    </div>
  )
}

export function PerformanceDataBoundary({ startDate, endDate, segmentId, children, loading }: Props & { loading?: ReactNode }) {
  const batch = useDashboardPerformance(startDate, endDate, segmentId)
  const selection = useReportLoadingSelection()
  const groups = useReportDataContext()
  return <BatchBoundary batch={batch} loading={loading ?? <ReportLoading
    report={selection.report ?? "performance"} section={selection.section ?? groups.performanceGroup}
    chartOnly={selection.report === "overview" && selection.section === "activity"} />}>
    {children}
  </BatchBoundary>
}

export function OverviewDataBoundary({ startDate, endDate, segmentId, children }: Props) {
  const batch = useDashboardOverview(startDate, endDate, segmentId)
  const selection = useReportLoadingSelection()
  const groups = useReportDataContext()
  return <BatchBoundary batch={batch} loading={<ReportLoading report="overview" section={selection.section ?? groups.overviewGroup} />}>
    {children}
  </BatchBoundary>
}

function BatchBoundary({ batch, children, loading }: { batch: ReturnType<typeof useDashboardPerformance>; children: ReactNode; loading: ReactNode }) {
  if (batch.isLoading || batch.isValidating) return loading
  if (batch.status === "unauthenticated" || batch.status === "no-site") {
    return <p role="status" className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
      {batch.status === "unauthenticated" ? "Sign in to view report metrics." : "Select a site to view report metrics."}
    </p>
  }
  if (batch.error?.availableCurrencies?.length) {
    return <p role="status" className="text-sm text-muted-foreground">Select a reporting currency above to view revenue and the sales trend.</p>
  }
  return batch.error ? <BatchError retry={() => { void batch.mutate() }} /> : <>{children}</>
}