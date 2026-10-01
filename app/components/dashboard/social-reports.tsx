"use client"

import type { ComponentType, ReactNode } from "react"
import { format } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { useSite } from "@/app/context/SiteContext"
import { Activity, Eye, MessageCircle, BarChart, Users } from "@/app/components/ui/icons"
import { getNetworkIcon } from "@/app/content/content-shared"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { SocialTrendsChart } from "./social-trends-chart"
import { SocialDataQuality } from "./social-data-quality"
import { SocialPostsTable } from "./social-posts-table"
import { ReportRequestError, SocialCostReportScope } from "./social-cost-report-state"
import { useSocialReport } from "./use-social-report"
import { ReportLoading } from "@/app/dashboard/ReportLoading"
import { ReportDetails, ReportKpiGrid, ReportSection } from "./report-layout"
import { BaseKpiWidget } from "./base-kpi-widget"

interface SocialReportsProps {
  startDate: Date
  endDate: Date
  segmentId?: string
  section?: "summary" | "networks" | "posts"
  embedded?: boolean
}

const numberFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
const engagementFormatter = new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 2 })

function KpiCard({ title, value, description, icon: Icon, isLoading }: {
  title: string
  value?: ReactNode
  description?: string
  icon: ComponentType<{ className?: string }>
  isLoading?: boolean
}) {
  return (
    <BaseKpiWidget title={title} value={value ?? null} changeText={description ?? ""} isLoading={!!isLoading}
      icon={<Icon className="h-4 w-4 text-muted-foreground" />} />
  )
}

export function SocialReports(props: SocialReportsProps) {
  return <SocialCostReportScope><SocialReportContent {...props} /></SocialCostReportScope>
}

function SocialReportContent({ startDate, endDate, section = "summary", embedded = false }: SocialReportsProps) {
  const { currentSite } = useSite()
  const showSummary = section === "summary"
  const showNetworks = section === "networks"
  const showPosts = section === "posts"
  const { performance, commenters, enabled, invalidDates, authLoading, signedOut } = useSocialReport(currentSite?.id, startDate, endDate, showNetworks)
  const data = performance.error ? undefined : performance.data
  const kpis = data?.kpis
  const posts = data?.data ?? []
  const networks = data?.networks ?? []
  const topCommenters = commenters.error ? [] : commenters.data ?? []
  const isLoading = performance.isLoading || performance.isValidating
  const isCommentersLoading = commenters.isLoading || commenters.isValidating
  const hasComments = (kpis?.totalComments ?? 0) > 0
  const coverage = data?.metadata
  const countValue = (metric: "views" | "reach" | "comments", value?: number) => {
    if (value === undefined || (coverage && coverage.postCount > 0 && coverage.missingMetricCounts[metric] >= coverage.postCount)) return "—"
    return numberFormatter.format(value)
  }
  const countDescription = (metric: "views" | "reach" | "comments", fallback: string) => coverage?.missingMetricCounts[metric]
    ? `Partial total · ${coverage.missingMetricCounts[metric]} posts without this metric` : fallback

  if (authLoading || isLoading) return <ReportLoading report="social" section={section} />
  if (invalidDates) return <p role="alert">Select a valid date range to view social reports.</p>
  if (signedOut) return <p role="alert">Sign in to view social reports.</p>
  if (!enabled) return <p className="text-sm text-muted-foreground">Select a site to view social reports.</p>

  return (
    <ReportSection embedded={embedded} title={section === "networks" ? "Social networks" : section === "posts" ? "Social posts" : "Social summary"}
      description={`${format(startDate, "MMM d, yyyy")} – ${format(endDate, "MMM d, yyyy")} · Accumulated metrics on posts published in this period`}>
      {performance.error && (
        <ReportRequestError
          title={showSummary ? "Unable to load performance trends" : "Unable to load social performance"}
          description="Social metrics could not be loaded. Missing metrics do not mean zero activity."
          retry={() => { void performance.mutate() }}
          retryLabel="Retry social performance"
          retrying={performance.isValidating}
        />
      )}

      {showSummary && !performance.error && <>
        <ReportKpiGrid>
          <KpiCard title="Views" value={countValue("views", kpis?.totalViews)} description={countDescription("views", "Accumulated views on dated posts")} isLoading={isLoading} icon={Eye} />
          <KpiCard title="Reach" value={countValue("reach", kpis?.totalReach)} description={countDescription("reach", "Summed post reach, not unique people")} isLoading={isLoading} icon={BarChart} />
          <KpiCard title="Engagement Rate" value={kpis?.avgEngagementRate != null ? engagementFormatter.format(kpis.avgEngagementRate) : "—"}
            description="Average of reported post rates, not a weighted audience rate" isLoading={isLoading} icon={Activity} />
          <KpiCard title="Comments" value={countValue("comments", kpis?.totalComments)} description={countDescription("comments", "Accumulated provider comment totals")} isLoading={isLoading} icon={MessageCircle} />
        </ReportKpiGrid>
        <SocialTrendsChart data={data?.trends} isLoading={isLoading} showPeriod={!embedded} />
      </>}

      {showNetworks && <div className={`grid min-w-0 items-stretch gap-4 [&>*]:min-w-0 ${!performance.error ? "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:grid-rows-[auto_1fr] xl:[&>*]:row-span-2 xl:[&>*]:grid xl:[&>*]:grid-rows-subgrid xl:[&>*]:gap-y-0" : ""}`}>
        {!performance.error && <Card className="flex h-full min-w-0 flex-col" data-report-panel="social-networks">
          <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3">
            <CardTitle className="text-base">By Network</CardTitle>
            <CardDescription className="text-xs">Reported account metrics, grouped by network.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 flex-1 p-4 pt-0 sm:p-5 sm:pt-0">
            {isLoading ? <Skeleton className="h-32 w-full" /> : networks.length > 0 ? (
              <div className="space-y-3">
                {networks.map((network) => (
                  <div key={network.network} className="min-w-0 space-y-3 rounded-lg border p-3 sm:p-4">
                    <div className="flex min-w-0 items-center gap-2 capitalize">
                      {getNetworkIcon(network.network)}
                      <span className="text-sm font-medium">{network.network}</span>
                    </div>
                    <dl className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4">
                      {(["views", "reach", "likes", "comments"] as const).map(metric => {
                        const missing = network.coverage?.missingMetricCounts[metric] ?? 0
                        const allMissing = network.coverage && missing >= network.coverage.accountRowCount
                        return <div key={metric} className="min-w-0">
                          <dt className="text-xs capitalize text-muted-foreground">{metric}</dt>
                          <dd className="mt-1 break-words text-lg font-semibold tabular-nums">{allMissing || !Number.isFinite(network[metric]) ? "—" : numberFormatter.format(network[metric])}
                            {missing > 0 && !allMissing && <span className="ml-1 text-xs font-normal text-muted-foreground">(partial)</span>}
                          </dd>
                        </div>
                      })}
                    </dl>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyCard icon={<Activity className="h-8 w-8" />} title="No network data"
                description="There is no performance data by network for this period." showShadow={false} variant="simple"
                contentClassName="min-h-0 py-8" />
            )}
            <ReportDetails summary="Network coverage" className="mt-4">
              <p>Reported account metrics by network. Coverage and provider definitions may differ from post totals. Missing metrics are shown as —, not zero; partial totals include only reported values.</p>
            </ReportDetails>
          </CardContent>
        </Card>}

        <Card className="flex h-full min-w-0 flex-col" data-report-panel="social-commenters">
          <CardHeader className="p-4 pb-3 sm:p-5 sm:pb-3">
            <CardTitle className="text-base">Top Commenters</CardTitle>
            <CardDescription className="text-xs">Synchronized inbound comments in the selected dates.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 flex-1 p-4 pt-0 sm:p-5 sm:pt-0">
            {isCommentersLoading ? <div role="status" aria-label="Loading top commenters"><Skeleton className="h-32 w-full" /></div> : commenters.error ? (
              <ReportRequestError title="Unable to load top commenters"
                description="Commenter data could not be loaded. Please try again."
                retry={() => { void commenters.mutate() }} retryLabel="Retry top commenters" retrying={commenters.isValidating} />
            ) : topCommenters.length > 0 ? (
              <div className="space-y-3">
                {topCommenters.map((commenter) => (
                  <div key={commenter.id} className="flex min-w-0 items-center justify-between gap-2 border-b py-3 last:border-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={commenter.avatar || undefined} alt={commenter.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {commenter.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 break-words text-sm font-medium">{commenter.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground font-medium bg-background px-2 py-1 rounded-md border">
                      <MessageCircle className="h-3 w-3" />
                      <span>{numberFormatter.format(commenter.count)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyCard icon={<Users className="h-8 w-8" />}
                title={hasComments ? "Comment authors not synchronized" : "No commenters found"}
                description={hasComments
                  ? "Post metrics report comments, but no synchronized comment authors are available for the selected time period."
                  : "No synchronized commenters were found for the selected time period."}
                showShadow={false} variant="simple" contentClassName="min-h-0 py-8" />
            )}
            <ReportDetails summary="What commenter counts mean" className="mt-4">
              <p>Authors of synchronized inbound comment messages created during the selected dates. This is not the accumulated comment total above.</p>
            </ReportDetails>
          </CardContent>
        </Card>
      </div>}

      {showPosts && !performance.error && <SocialPostsTable posts={posts} isLoading={isLoading} />}
      {!performance.error && <SocialDataQuality metadata={coverage} refreshing={performance.isValidating || commenters.isValidating}
        refresh={() => { void performance.mutate(); if (showNetworks) void commenters.mutate() }} />}
    </ReportSection>
  )
}