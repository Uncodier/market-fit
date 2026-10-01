"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { useReportResource } from "@/app/hooks/use-report-resource"
import { DistributionChart } from "../distribution-chart"
import { ReportSection } from "../report-layout"
import { ReportState } from "../report-state"
import { ReportDistributionLoading } from "../report-visual-loading"
import { fetchReport, formatDistributionValue, reportQueryKey, type DistributionItem, type ReportPeriod, type ReportRequestError } from "../report-query"
import { parseTrafficAttribution, type TrafficAttributionData } from "./attribution-data"

async function fetchAttribution(key: [string, string]) {
  return parseTrafficAttribution(await fetchReport(key))
}

function AttributionPanel({ title, description, data, dimension }: {
  title: string
  description: string
  data?: DistributionItem[]
  dimension: "segments" | "campaigns"
}) {
  return <Card className="flex h-full min-w-0 flex-col shadow-none" data-report-panel={`traffic-${dimension}`}>
    <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3">
      <CardTitle className="text-base">{title}</CardTitle>
      <CardDescription className="text-xs">{description}</CardDescription>
    </CardHeader>
    <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col p-4 pt-0 sm:p-5 sm:pt-0">
      {!data ? <ReportDistributionLoading label={`Loading ${title.toLowerCase()}`} />
        : <DistributionChart data={data} title={title} variant="stacked" countLabel="Sessions"
          populationLabel="all sessions in the selected period" totalLabel="Total sessions" />}
    </CardContent>
  </Card>
}

export function TrafficAttribution({ siteId, userId, segmentId, period, embedded = false }: {
  siteId: string
  userId: string
  segmentId: string
  period: ReportPeriod
  embedded?: boolean
}) {
  const key = reportQueryKey({ endpoint: "traffic/attribution", siteId, userId, segmentId, period })
  const { data, isLoading, error, mutate } = useReportResource<TrafficAttributionData, ReportRequestError>(key, fetchAttribution)
  const coverage = data?.coverage
  const panels = <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
    <AttributionPanel dimension="segments" title="Sessions by Segment" data={data?.segments}
      description="Current lead or visitor segment. Includes unassigned sessions; not historical membership." />
    <AttributionPanel dimension="campaigns" title="Sessions by Campaign" data={data?.campaigns}
      description="Campaign UTM at session entry. Includes sessions without a campaign tag." />
  </div>
  return <ReportSection embedded={embedded} title="Traffic attribution" description="Understand which audiences and tagged campaigns bring sessions to your site.">
    {isLoading ? panels
      : error ? <ReportState state="error" message={error.message} onRetry={() => { void mutate() }} />
      : !coverage ? panels
      : coverage.totalSessions === 0 ? <ReportState state="empty" message="No sessions for the selected period." />
      : <>
        <dl aria-label="Attribution coverage" className="grid min-w-0 grid-cols-2 gap-3 rounded-lg border bg-muted/20 p-4 lg:grid-cols-4">
          <div><dt className="text-xs text-muted-foreground">Sessions analyzed</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{formatDistributionValue(coverage.totalSessions)}</dd></div>
          {([
            ["Identifiable source", coverage.attributedSessions],
            ["Assigned segment", coverage.segmentedSessions],
            ["Tagged campaign", coverage.campaignSessions],
          ] as const).map(([label, count]) => <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{(count / coverage.totalSessions * 100).toFixed(1)}% <span className="text-xs font-normal text-muted-foreground">({formatDistributionValue(count)})</span></dd>
          </div>)}
        </dl>
        {panels}
        <p className="text-xs leading-relaxed text-muted-foreground">
          {formatDistributionValue(coverage.unattributedSessions)} of {formatDistributionValue(coverage.totalSessions)} sessions have no identifiable external source.
          {" "}Missing referral data does not prove a direct visit. Each chart counts every session once, including unassigned categories and grouped remaining results.
        </p>
      </>}
  </ReportSection>
}