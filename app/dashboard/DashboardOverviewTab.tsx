"use client"

import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { RecentActivity } from "@/app/components/dashboard/recent-activity"
import { Overview } from "@/app/components/dashboard/overview"
import { RevenueWidget } from "@/app/components/dashboard/revenue-widget"
import { ActiveUsersWidget } from "@/app/components/dashboard/active-users-widget"
import { ActiveSegmentsWidget } from "@/app/components/dashboard/active-segments-widget"
import { ActiveCampaignsWidget } from "@/app/components/dashboard/active-campaigns-widget"
import { LTVWidget } from "@/app/components/dashboard/ltv-widget"
import { ROIWidget } from "@/app/components/dashboard/roi-widget"
import { CACWidget } from "@/app/components/dashboard/cac-widget"
import { CPLWidget } from "@/app/components/dashboard/cpl-widget"
import { Switch } from "@/app/components/ui/switch"
import { Label } from "@/app/components/ui/label"
import { useState } from "react"

const PerformanceMetricsChart = dynamic(
  () => import("@/app/components/dashboard/performance-metrics-chart").then((m) => m.PerformanceMetricsChart),
  { ssr: false }
)

export function DashboardOverviewTab({
  t,
  segmentId,
  startDate,
  endDate,
}: {
  t: (key: string) => string
  segmentId: string
  startDate: Date
  endDate: Date
}) {
  const [showConversations, setShowConversations] = useState(false)

  return (
    <>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 min-h-[160px]">
        <RevenueWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
        <ActiveUsersWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
        <ActiveSegmentsWidget startDate={startDate} endDate={endDate} />
        <ActiveCampaignsWidget startDate={startDate} endDate={endDate} />
        <LTVWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
        <CACWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
        <ROIWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
        <CPLWidget segmentId={segmentId} startDate={startDate} endDate={endDate} />
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card className="col-span-1 flex flex-col min-h-[350px] lg:min-h-[500px]">
          <CardHeader className="flex-shrink-0">
            <CardTitle>{t("dashboard.overview.title") || "Overview"}</CardTitle>
          </CardHeader>
          <CardContent className="pl-2 flex-1 flex flex-col">
            <div className="flex-1 relative">
              <div className="absolute inset-0">
                <Overview startDate={startDate} endDate={endDate} segmentId={segmentId} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1 flex flex-col min-h-[350px] lg:min-h-[500px]">
          <CardHeader className="flex-shrink-0">
            <CardTitle>{t("dashboard.recentActivity.title") || "Recent commercial activity"}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <RecentActivity limit={6} startDate={startDate} endDate={endDate} />
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 grid-cols-1 mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex flex-col space-y-1.5">
              <CardTitle>{t("dashboard.metrics.performance.title") || "Performance Metrics"}</CardTitle>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="overview-show-conversations" checked={showConversations} onCheckedChange={setShowConversations} />
              <Label htmlFor="overview-show-conversations" className="text-sm text-muted-foreground cursor-pointer">
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
    </>
  )
}
