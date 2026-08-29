"use client"

import dynamic from "next/dynamic"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { SegmentDonut } from "@/app/components/dashboard/segment-donut"

const CohortTables = dynamic(
  () => import("@/app/components/dashboard/cohort-tables").then((m) => m.CohortTables),
  { ssr: false }
)
const LeadsCohortTables = dynamic(
  () => import("@/app/components/dashboard/leads-cohort-tables").then((m) => m.LeadsCohortTables),
  { ssr: false }
)

export function DashboardAnalyticsTab({
  t,
  segmentId,
  startDate,
  endDate,
  formattedTotal,
  onTotalUpdate,
}: {
  t: (key: string) => string
  segmentId: string
  startDate: Date
  endDate: Date
  formattedTotal: string
  onTotalUpdate: (total: string) => void
}) {
  return (
    <>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 min-h-[160px]">
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("dashboard.analytics.clientsBySegment.title") || "Clients by Segment"}</CardTitle>
            <CardDescription className="text-xs">
              {t("dashboard.analytics.clientsBySegment.desc") || "Distribution of clients across segments"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <SegmentDonut segmentId={segmentId} startDate={startDate} endDate={endDate} endpoint="clients-by-segment" />
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("dashboard.analytics.revenueBySegment.title") || "Revenue by Segment"}</CardTitle>
            <CardDescription className="text-xs">
              {t("dashboard.analytics.revenueBySegment.desc") || "Distribution of revenue across segments"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <SegmentDonut
              segmentId={segmentId}
              startDate={startDate}
              endDate={endDate}
              endpoint="revenue-by-segment"
              formatValues={true}
            />
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("dashboard.analytics.clientsByCampaign.title") || "Clients by Campaign"}</CardTitle>
            <CardDescription className="text-xs">
              {t("dashboard.analytics.clientsByCampaign.desc") || "Distribution of clients across campaigns"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <SegmentDonut segmentId={segmentId} startDate={startDate} endDate={endDate} endpoint="clients-by-campaign" />
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("dashboard.analytics.revenueByCampaign.title") || "Revenue by Campaign"}</CardTitle>
            <CardDescription className="text-xs">
              {t("dashboard.analytics.revenueByCampaign.desc") || "Revenue across campaigns"}
              {formattedTotal ? ` - ${formattedTotal}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <SegmentDonut
              segmentId={segmentId}
              startDate={startDate}
              endDate={endDate}
              endpoint="revenue-by-campaign"
              formatValues={true}
              onTotalUpdate={onTotalUpdate}
            />
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.analytics.clientCohort.title") || "Client Cohort Analysis"}</CardTitle>
            <CardDescription>
              {t("dashboard.analytics.clientCohort.desc") || "Week-to-week retention metrics for users with at least 1 paid invoice (standardized)."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CohortTables segmentId={segmentId} startDate={startDate} endDate={endDate} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.analytics.leadCohort.title") || "Lead Cohort Analysis"}</CardTitle>
            <CardDescription>
              {t("dashboard.analytics.leadCohort.desc") || "Week-to-week lead retention metrics - tracking lead engagement over time (standardized)."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LeadsCohortTables segmentId={segmentId} startDate={startDate} endDate={endDate} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
