"use client"

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
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 lg:items-start">
        <Card className="col-span-1 flex flex-col min-h-[350px] lg:h-[500px]">
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
        <Card className="col-span-1 flex flex-col h-auto">
          <CardHeader className="flex-shrink-0">
            <CardTitle>{t("dashboard.recentActivity.title") || "Recent commercial activity"}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <RecentActivity limit={6} startDate={startDate} endDate={endDate} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
