"use client"

import dynamic from "next/dynamic"
import { Card } from "@/app/components/ui/card"
import { SegmentDonut } from "@/app/components/dashboard/segment-donut"
import { ReportDetails, ReportSection as VisualSection } from "@/app/components/dashboard/report-layout"
import { ReportTableLoading } from "@/app/components/dashboard/report-visual-loading"
import type { ReportSection } from "./report-sections"

const CohortTables = dynamic(
  () => import("@/app/components/dashboard/cohort-tables").then((m) => m.CohortTables),
  { ssr: false, loading: () => <ReportTableLoading /> }
)
const LeadsCohortTables = dynamic(
  () => import("@/app/components/dashboard/leads-cohort-tables").then((m) => m.LeadsCohortTables),
  { ssr: false, loading: () => <ReportTableLoading /> }
)

export function DashboardAnalyticsTab({
  t,
  segmentId,
  startDate,
  endDate,
  section = "distribution",
  embedded = false,
}: {
  t: (key: string) => string
  segmentId: string
  startDate: Date
  endDate: Date
  section?: ReportSection<"analytics">
  embedded?: boolean
}) {
  const filters = { segmentId, startDate, endDate }
  if (section === "customers") return (
    <VisualSection embedded={embedded} title={t("dashboard.analytics.clientCohort.title") || "Client Cohort Analysis"}
      description="Follow identified customers from their first confirmed sale observed in this date range.">
      <CohortTables {...filters} />
    </VisualSection>
  )
  if (section === "leads") return (
    <VisualSection embedded={embedded} title={t("dashboard.analytics.leadCohort.title") || "Lead Cohort Analysis"}
      description="Lead cohorts by creation date and recorded engagement, not estimated retention.">
      <LeadsCohortTables {...filters} />
    </VisualSection>
  )
  return (
    <div className="min-w-0 space-y-6">
      {(["segment", "campaign"] as const).map(dimension => {
        const label = dimension === "segment" ? "Segment" : "Campaign"
        return (
          <VisualSection key={dimension} title={`${label} comparison`}
            description={dimension === "segment" ? "Compare lead distribution with recorded sale amounts by segment." : "Compare attribution across active campaigns."}>
            <Card className="grid min-w-0 grid-cols-1 divide-y shadow-none lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              <div className="min-w-0 space-y-4 p-4 sm:p-5">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Leads by {label}</h3>
                  <p className="text-xs text-muted-foreground">Contact count · share of displayed results</p>
                </div>
                <SegmentDonut {...filters} showTotal variant="compact" endpoint={`clients-by-${dimension}`} />
              </div>
              <div className="min-w-0 space-y-4 p-4 sm:p-5">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Recorded Sales by {label}</h3>
                  <p className="text-xs text-muted-foreground">Reported amounts · all statuses</p>
                </div>
                <SegmentDonut {...filters} showTotal variant="compact" endpoint={`revenue-by-${dimension}`} formatValues />
              </div>
            </Card>
          </VisualSection>
        )
      })}
      <ReportDetails summary="Attribution and source definitions">
        <p>Lead counts include created leads and contacts linked to sales, grouped by segment or attributed to active campaigns.</p>
        <p>Sale amounts use creation date across all statuses. Currency is not provided by this source. These distributions are not confirmed revenue or cash receipts; use Sales for currency-specific confirmed totals.</p>
        <p>Each measure shows its own share of displayed results. Contact counts and sale amounts have different units and should not be added together.</p>
      </ReportDetails>
    </div>
  )
}
