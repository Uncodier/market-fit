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
import { ReportDistributionLoading, ReportTableLoading } from "./report-visual-loading"
import { TrafficRanking } from "./traffic/traffic-ranking"
import { ReportLoading } from "@/app/dashboard/ReportLoading"
import { TrafficAttribution } from "./traffic/traffic-attribution"

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
  pages: { title: "Top Visited Pages", description: "Recorded landing and current pages, not all pageview events" },
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
  const ranking = endpoint === "pages" || endpoint === "regions"
  const loading = ranking ? <ReportTableLoading label={`Loading ${title.toLowerCase()}`} />
    : <ReportDistributionLoading label={`Loading ${title.toLowerCase()}`} />
  return (
    <Card className="flex h-full min-w-0 flex-col shadow-none" data-report-panel={`traffic-${endpoint}`}>
      <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col p-4 pt-0 sm:p-5 sm:pt-0">
        {isLoading || isValidating ? loading
          : error ? <ReportState state="error" message={error.message} onRetry={() => { void mutate() }} />
          : !data ? loading
          : !distributionTotal(data) ? <ReportState state="empty" message="No data for the selected filters." />
          : ranking
            ? <TrafficRanking data={data} title={title} />
            : <DistributionChart data={data} title={title} variant="stacked" countLabel="Sessions"
              populationLabel="all sessions in the selected period" totalLabel="Total sessions" />}
      </CardContent>
    </Card>
  )
}

export function TrafficReports({ startDate, endDate, segmentId = "all", siteId,
  section = "summary", embedded = false }: TrafficReportsProps) {
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

  const showSummary = section === "summary"
  const showAudience = section === "audience"
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
        <TrafficAttribution {...distributionProps} embedded={embedded} />
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
      {section === "sessions" && <ReportSection embedded={embedded} title="Session activity" description="Page visits over time with referral context.">
        <SessionEventsContainer siteId={siteId} {...filters} />
      </ReportSection>}
      {(showSummary || showAudience) && <ReportDetails summary="Traffic coverage">
        <p>Source, audience and attribution breakdowns count sessions created in the selected period, not unique visitors. Missing attribution remains in the totals; remaining categories are grouped rather than discarded. Different dimensions are not additive.</p>
        {showSummary && <>
          <p>Top Visited Pages counts recorded landing and current URLs, so a session can contribute more than once. It is not a complete pageview report; the Sessions tab counts recorded pageview events.</p>
          <p>Source and campaign attribution use recorded session-entry UTM values, then the landing URL, then the external referrer for the source. Internal navigation and direct / unknown traffic are not evidence of an external acquisition source. No first-touch or last-non-direct model is inferred.</p>
          <p>Segment attribution uses the linked lead or visitor&apos;s current segment within this site, not the segment at the time of the visit. Campaigns are UTM tags, not inferred CRM campaign assignments.</p>
          <p>To improve coverage, consistently tag campaign links with utm_source, utm_medium and utm_campaign, preserve those parameters through redirects, and link identified visitors to leads and segments. Historical sessions with no recorded source cannot be reliably reconstructed.</p>
        </>}
      </ReportDetails>}
    </div>
  )
}
