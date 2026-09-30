"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { SessionsWidget } from "./traffic/visits-widget"
import { ClientConversionWidget } from "./traffic/client-conversion-widget"
import { SessionTimeWidget } from "./traffic/session-time-widget"
import { LeadConversionWidget } from "./traffic/lead-conversion-widget"
import { SessionEventsContainer } from "./traffic/session-events-container"
import { useWidgetContext } from "@/app/context/WidgetContext"
import { useAuth } from "@/app/hooks/use-auth"
import { DistributionChart } from "./distribution-chart"
import { ReportState } from "./report-state"
import { distributionTotal, reportPeriod, type ReportPeriod } from "./report-query"
import { useDistributionReport } from "./use-distribution-report"
import { ReportDetails, ReportKpiGrid, ReportSection } from "./report-layout"
import { ReportTableLoading } from "./report-visual-loading"
import { TrafficRanking } from "./traffic/traffic-ranking"
import { ReportLoading } from "@/app/dashboard/ReportLoading"

export type TrafficSection = "summary" | "audience" | "sessions"

interface TrafficReportsProps {
  startDate?: Date
  endDate?: Date
  segmentId?: string
  siteId: string
  section?: TrafficSection
  embedded?: boolean
}

const reports = {
  pages: { title: "Top Visited Pages", description: "Most popular pages on your site" },
  referrals: { title: "Referral Sources", description: "Where visitors come from" },
  browsers: { title: "Browsers", description: "Most popular browsers used to visit" },
  regions: { title: "Geographic Regions", description: "Visitor locations by region" },
  devices: { title: "Device Types", description: "Types of devices used to visit" },
} as const

function TrafficDistribution({ endpoint, siteId, userId, segmentId, period }: {
  endpoint: keyof typeof reports
  siteId: string
  userId: string
  segmentId: string
  period: ReportPeriod
}) {
  const { data, isLoading, isValidating, error, mutate } = useDistributionReport({
    endpoint: `traffic/${endpoint}`, userId, siteId, segmentId, period, enabled: true,
  })
  const { title, description } = reports[endpoint]
  return (
    <Card className="flex h-full min-w-0 flex-col shadow-none" data-report-panel={`traffic-${endpoint}`}>
      <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 flex-1 p-4 pt-0 sm:p-5 sm:pt-0">
        {isLoading || isValidating ? <ReportTableLoading label={`Loading ${title.toLowerCase()}`} />
          : error ? <ReportState state="error" message={error.message} onRetry={() => { void mutate() }} />
          : !data ? <ReportTableLoading label={`Loading ${title.toLowerCase()}`} />
          : !distributionTotal(data) ? <ReportState state="empty" message="No data for the selected filters." />
          : endpoint === "pages" || endpoint === "regions"
            ? <TrafficRanking data={data} title={title} />
            : <DistributionChart data={data} title={title} variant="compact" />}
      </CardContent>
    </Card>
  )
}

export function TrafficReports({ startDate, endDate, segmentId = "all", siteId, section, embedded = false }: TrafficReportsProps) {
  const { shouldExecuteWidgets } = useWidgetContext()
  const { user, isLoading: authLoading } = useAuth()
  const start = startDate?.getTime()
  const end = endDate?.getTime()
  const period = useMemo(() => reportPeriod(
    start === undefined ? undefined : new Date(start),
    end === undefined ? undefined : new Date(end),
  ), [start, end])

  if (authLoading) return <ReportLoading report="traffic" section={section} />
  if (!user?.id) return <ReportState state="error" message="Sign in to view traffic reports." />
  if (!siteId || siteId === "default") return <ReportState state="empty" message="Select a site to view traffic reports." />
  if (!period) return <ReportState state="error" message="Select a valid date range." />
  if (!shouldExecuteWidgets) return <ReportLoading report="traffic" section={section} />

  const showSummary = !section || section === "summary"
  const showAudience = !section || section === "audience"
  const filters = { ...period, segmentId }
  const distributionProps = { siteId, userId: user.id, segmentId, period }
  return (
    <div className="min-w-0 space-y-6">
      {showSummary && <>
        <ReportKpiGrid>
          <SessionsWidget {...filters} />
          <SessionTimeWidget {...filters} />
          <LeadConversionWidget {...filters} />
          <ClientConversionWidget {...filters} />
        </ReportKpiGrid>
        <ReportSection embedded={embedded} title="Acquisition breakdown" description="See which pages attract visits and where visitors arrive from.">
          <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:grid-rows-[auto_1fr] xl:[&>*]:row-span-2 xl:[&>*]:grid xl:[&>*]:grid-rows-subgrid xl:[&>*]:gap-y-0">
            <TrafficDistribution endpoint="pages" {...distributionProps} />
            <TrafficDistribution endpoint="referrals" {...distributionProps} />
          </div>
        </ReportSection>
      </>}
      {showAudience && <ReportSection embedded={embedded} title="Audience profile" description="Geography alongside the devices and browsers used to visit.">
        <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-3 xl:grid-rows-[auto_1fr] xl:[&>*]:row-span-2 xl:[&>*]:grid xl:[&>*]:grid-rows-subgrid xl:[&>*]:gap-y-0 [&>*]:min-w-0">
          <TrafficDistribution endpoint="regions" {...distributionProps} />
          <TrafficDistribution endpoint="devices" {...distributionProps} />
          <TrafficDistribution endpoint="browsers" {...distributionProps} />
        </div>
      </ReportSection>}
      {(!section || section === "sessions") && <ReportSection embedded={embedded} title="Session activity" description="Page visits over time with referral context.">
        <SessionEventsContainer siteId={siteId} {...filters} />
      </ReportSection>}
      {(showSummary || showAudience) && <ReportDetails summary="Traffic coverage">
        <p>Each breakdown shows its own share of displayed results. Different traffic dimensions are not additive and may have different coverage.</p>
      </ReportDetails>}
    </div>
  )
}
