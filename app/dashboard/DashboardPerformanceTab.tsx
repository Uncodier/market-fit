"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { PerformanceDataBoundary } from "./ReportBatchBoundary"
import type { ReportSection } from "./report-sections"
import { Card } from "@/app/components/ui/card"
import { ReportDetails, ReportKpiGrid, ReportSection as VisualSection } from "@/app/components/dashboard/report-layout"
import { ReportChartLoading } from "@/app/components/dashboard/report-visual-loading"
import { Switch } from "@/app/components/ui/switch"
import { Label } from "@/app/components/ui/label"
import { TasksWidget } from "@/app/components/dashboard/tasks-widget"
import { ConversationsWidget } from "@/app/components/dashboard/conversations-widget"
import { ContentsApprovedWidget } from "@/app/components/dashboard/contents-approved-widget"
import { RequirementsCompletedWidget } from "@/app/components/dashboard/requirements-completed-widget"
import { LeadsContactedWidget } from "@/app/components/dashboard/leads-contacted-widget"
import { LeadsInConversationWidget } from "@/app/components/dashboard/leads-in-conversation-widget"
import { MeetingsWidget } from "@/app/components/dashboard/meetings-widget"
import { SalesKpiWidget } from "@/app/components/dashboard/sales-kpi-widget"
import { InputTokensWidget } from "@/app/components/dashboard/input-tokens-widget"
import { OutputTokensWidget } from "@/app/components/dashboard/output-tokens-widget"
import { VideoMinutesWidget } from "@/app/components/dashboard/video-minutes-widget"
import { ImagesGeneratedWidget } from "@/app/components/dashboard/images-generated-widget"

const TokenUsageChart = dynamic(
  () => import("@/app/components/dashboard/token-usage-chart").then((m) => m.TokenUsageChart),
  { ssr: false, loading: ReportChartLoading }
)
const PerformanceMetricsChart = dynamic(
  () => import("@/app/components/dashboard/performance-metrics-chart").then((m) => m.PerformanceMetricsChart),
  { ssr: false, loading: ReportChartLoading }
)
const LeadsTasksChart = dynamic(
  () => import("@/app/components/dashboard/leads-tasks-chart").then((m) => m.LeadsTasksChart),
  { ssr: false, loading: ReportChartLoading }
)

export function DashboardPerformanceTab({
  t,
  segmentId,
  startDate,
  endDate,
  section = "outcomes",
}: {
  t: (key: string) => string
  segmentId: string
  startDate: Date
  endDate: Date
  section?: ReportSection<"performance">
}) {
  const [showConversations, onShowConversationsChange] = useState(false)
  const filters = { segmentId, startDate, endDate }
  return (
    <PerformanceDataBoundary {...filters}>
      <div className="min-w-0 space-y-4">
        {section === "outcomes" && <>
          <ReportKpiGrid>
            <LeadsContactedWidget {...filters} />
            <LeadsInConversationWidget {...filters} />
            <MeetingsWidget {...filters} />
            <SalesKpiWidget {...filters} />
          </ReportKpiGrid>
          <Card className="min-w-0 p-4 sm:p-5">
            <VisualSection title={t("dashboard.metrics.performance.title") || "Performance Metrics"}
              description="Engagement, meetings and recorded sales · daily counts"
              action={<div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Switch id="show-conversations" checked={showConversations} onCheckedChange={onShowConversationsChange} />
                <Label htmlFor="show-conversations" className="cursor-pointer text-xs">
                  {t("dashboard.metrics.performance.showConversations") || "Show Conversations"}
                </Label>
              </div>}>
              <PerformanceMetricsChart {...filters} showConversations={showConversations} />
              <ReportDetails summary="Activity definitions">
                <p>Daily activity counts in UTC. Sales count created records across all statuses, not revenue. Use the Sales report for confirmed sale amounts.</p>
                <p>Each series is an independent activity count, not a sequential conversion funnel.</p>
              </ReportDetails>
            </VisualSection>
          </Card>
        </>}
        {section === "operations" && <>
          <ReportKpiGrid>
            <TasksWidget {...filters} />
            <ConversationsWidget {...filters} />
            <ContentsApprovedWidget {...filters} />
            <RequirementsCompletedWidget {...filters} />
          </ReportKpiGrid>
          <Card className="min-w-0 p-4 sm:p-5">
            <VisualSection title={t("dashboard.metrics.customerSuccess.title") || "Customer Success Metrics"}
              description="Leads created and tasks · daily counts">
              <LeadsTasksChart {...filters} />
              <ReportDetails summary="Activity definitions">
                <p>Lead and task creation is grouped by UTC day. These series describe incoming activity, not task completion or customer retention.</p>
              </ReportDetails>
            </VisualSection>
          </Card>
        </>}
        {section === "usage" && <>
          <ReportKpiGrid>
            <InputTokensWidget {...filters} />
            <OutputTokensWidget {...filters} />
            <VideoMinutesWidget {...filters} />
            <ImagesGeneratedWidget {...filters} />
          </ReportKpiGrid>
          <Card className="min-w-0 p-4 sm:p-5">
            <VisualSection title={t("dashboard.metrics.tokenUsage.title") || "Token Usage"}
              description="Input and output token consumption over time">
              <TokenUsageChart {...filters} />
            </VisualSection>
          </Card>
        </>}
      </div>
    </PerformanceDataBoundary>
  )
}
