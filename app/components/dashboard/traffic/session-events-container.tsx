"use client"

import { useAuth } from "@/app/hooks/use-auth"
import { useReportResource } from "@/app/hooks/use-report-resource"
import { Card } from "@/app/components/ui/card"
import { ReportState } from "../report-state"
import { fetchSessionEvents, sessionEventsUrl } from "./session-events-data"
import { SessionEventsChart } from "./session-events-chart"
import { SessionEventsReferrers } from "./session-events-referrers"

interface SessionEventsContainerProps {
  siteId: string;
  startDate: Date;
  endDate: Date;
  segmentId?: string;
}

const layout = "grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:grid-rows-[auto_1fr] xl:[&>*]:row-span-2 xl:[&>*]:grid xl:[&>*]:grid-rows-subgrid xl:[&>*]:gap-y-0 [&>*]:min-w-0 [&_h3]:text-base"

export function SessionEventsContainer({ siteId, startDate, endDate, segmentId }: SessionEventsContainerProps) {
  const { user, isLoading: authLoading } = useAuth()
  const hasSite = !!siteId && siteId !== "default"
  const url = sessionEventsUrl(siteId, startDate, endDate, segmentId)
  const { data, error, isLoading, mutate } = useReportResource(
    hasSite && url && user?.id && !authLoading ? [url, user.id] : null,
    fetchSessionEvents, authLoading,
  )

  if (isLoading) return <div className={layout} role="status" aria-label="Loading session events" aria-busy="true">
    <SessionEventsChart siteId={siteId} startDate={startDate} endDate={endDate} data={[]} loading />
    <SessionEventsReferrers siteId={siteId} startDate={startDate} endDate={endDate} data={[]} loading />
  </div>
  if (!user) return <ReportState state="error" message="Sign in to view session events." />
  if (!hasSite) return <ReportState state="empty" message="Select a site to view session events." />
  if (!url) return <ReportState state="error" message="Select a valid date range." />
  if (error) return <Card><ReportState state="error" message={error.message} onRetry={() => { void mutate() }} /></Card>
  if (!data) return null

  return (
    <div className={layout}>
      <SessionEventsChart 
        siteId={siteId}
        startDate={startDate}
        endDate={endDate}
        data={data.chartData}
        loading={false}
        error={null}
        totals={data.totals}
      />
      <SessionEventsReferrers 
        siteId={siteId}
        startDate={startDate}
        endDate={endDate}
        data={data.referrersData}
        loading={false}
        error={null}
      />
    </div>
  );
} 