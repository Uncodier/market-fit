"use client"

import dynamic from "next/dynamic"
import { RecentActivity } from "@/app/components/dashboard/recent-activity"
import { OverviewSalesTrend } from "./OverviewSalesTrend"
import { RevenueWidget } from "@/app/components/dashboard/revenue-widget"
import { ActiveUsersWidget } from "@/app/components/dashboard/active-users-widget"
import { ActiveSegmentsWidget } from "@/app/components/dashboard/active-segments-widget"
import { ActiveCampaignsWidget } from "@/app/components/dashboard/active-campaigns-widget"
import { Switch } from "@/app/components/ui/switch"
import { Label } from "@/app/components/ui/label"
import { useState } from "react"
import { OverviewDataBoundary, PerformanceDataBoundary } from "./ReportBatchBoundary"
import type { ReportSection } from "./report-sections"
import { OverviewCurrencyScope } from "./OverviewCurrencyScope"
import { ReportLoading } from "./ReportLoading"
import { ReportKpiGrid } from "@/app/components/dashboard/report-layout"
import { OverviewActivityLayout } from "./OverviewActivityLayout"
import { ReportChartLoading } from "@/app/components/dashboard/report-visual-loading"

const OverviewEconomics = dynamic(
  () => import("./OverviewEconomics").then((m) => m.OverviewEconomics),
  { ssr: false, loading: ReportLoading }
)

const PerformanceMetricsChart = dynamic(
  () => import("@/app/components/dashboard/performance-metrics-chart").then((m) => m.PerformanceMetricsChart),
  { ssr: false, loading: ReportChartLoading }
)

export function DashboardOverviewTab({
  t,
  segmentId,
  startDate,
  endDate,
  section = "summary",
}: {
  t: (key: string) => string
  segmentId: string
  startDate: Date
  endDate: Date
  section?: ReportSection<"overview">
}) {
  const [showConversations, setShowConversations] = useState(false)

  return (
    <OverviewCurrencyScope enabled={section === "summary"} startDate={startDate} endDate={endDate} segmentId={segmentId}>
    <OverviewDataBoundary startDate={startDate} endDate={endDate} segmentId={segmentId}>
      {section === "summary" && <div className="space-y-5">
      <ReportKpiGrid aria-label="Business summary">
        <RevenueWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
        <ActiveUsersWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
        <ActiveSegmentsWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
        <ActiveCampaignsWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
      </ReportKpiGrid>
      <OverviewSalesTrend startDate={startDate} endDate={endDate} segmentId={segmentId} />
      </div>}
      {section === "economics" && <OverviewEconomics segmentId={segmentId} startDate={startDate} endDate={endDate} />}
      {section === "activity" && <OverviewActivityLayout
        activityTitle={t("dashboard.recentActivity.title") || "Recent commercial activity"}
        action={<>
          <Switch id="overview-show-conversations" checked={showConversations} onCheckedChange={setShowConversations} />
          <Label htmlFor="overview-show-conversations" className="text-sm text-muted-foreground cursor-pointer">
            {t("dashboard.metrics.performance.showConversations") || "Show Conversations"}
          </Label>
        </>}
        chart={<PerformanceDataBoundary startDate={startDate} endDate={endDate} segmentId={segmentId} loading={<ReportChartLoading />}>
            <PerformanceMetricsChart
              segmentId={segmentId}
              startDate={startDate}
              endDate={endDate}
              showConversations={showConversations}
            />
        </PerformanceDataBoundary>}
        activity={<RecentActivity limit={6} startDate={startDate} endDate={endDate} />}
      />}
    </OverviewDataBoundary>
    </OverviewCurrencyScope>
  )
}
