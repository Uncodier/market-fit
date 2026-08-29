"use client"

import dynamic from "next/dynamic"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
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
  { ssr: false }
)
const PerformanceMetricsChart = dynamic(
  () => import("@/app/components/dashboard/performance-metrics-chart").then((m) => m.PerformanceMetricsChart),
  { ssr: false }
)
const LeadsTasksChart = dynamic(
  () => import("@/app/components/dashboard/leads-tasks-chart").then((m) => m.LeadsTasksChart),
  { ssr: false }
)

export function DashboardPerformanceTab({
  t,
  segmentId,
  startDate,
  endDate,
  showConversations,
  onShowConversationsChange,
}: {
  t: (key: string) => string
  segmentId: string
  startDate: Date
  endDate: Date
  showConversations: boolean
  onShowConversationsChange: (value: boolean) => void
}) {
  return (
    <>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 min-h-[160px]">
        <LeadsContactedWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
        <LeadsInConversationWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
        <MeetingsWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
        <SalesKpiWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
        <TasksWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
        <ConversationsWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
        <ContentsApprovedWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
        <RequirementsCompletedWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
      </div>
      <div className="grid gap-4 grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex flex-col space-y-1.5">
              <CardTitle>{t("dashboard.metrics.performance.title") || "Performance Metrics"}</CardTitle>
              <CardDescription>{t("dashboard.metrics.performance.desc") || "Conversations, engagement, meetings, and sales over time"}</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="show-conversations" checked={showConversations} onCheckedChange={onShowConversationsChange} />
              <Label htmlFor="show-conversations" className="text-sm text-muted-foreground cursor-pointer">
                {t("dashboard.metrics.performance.showConversations") || "Show Conversations"}
              </Label>
            </div>
          </CardHeader>
          <CardContent>
            <PerformanceMetricsChart
              segmentId={segmentId}
              startDate={startDate}
              endDate={endDate}
              showConversations={showConversations}
            />
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.metrics.customerSuccess.title") || "Customer Success Metrics"}</CardTitle>
            <CardDescription>{t("dashboard.metrics.customerSuccess.desc") || "Daily created leads and tasks over time"}</CardDescription>
          </CardHeader>
          <CardContent>
            <LeadsTasksChart segmentId={segmentId} startDate={startDate} endDate={endDate} />
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.metrics.tokenUsage.title") || "Token Usage"}</CardTitle>
            <CardDescription>{t("dashboard.metrics.tokenUsage.desc") || "Input vs Output token consumption over time"}</CardDescription>
          </CardHeader>
          <CardContent>
            <TokenUsageChart segmentId={segmentId} startDate={startDate} endDate={endDate} />
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 min-h-[160px]">
        <InputTokensWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
        <OutputTokensWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
        <VideoMinutesWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
        <ImagesGeneratedWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
      </div>
    </>
  )
}
