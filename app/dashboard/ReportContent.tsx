"use client"

import dynamic from "next/dynamic"
import { format } from "date-fns"
import { ReportExportScope } from "./export/ReportExportScope"
import { ReportDataProvider } from "./ReportDataContext"
import { ReportLoading, ReportLoadingScope } from "./ReportLoading"
import { getReportSection, type ReportId } from "./report-sections"

// Next's compiler requires a literal options object for each dynamic import.
const Performance = dynamic(
  () => import("./DashboardPerformanceTab").then((m) => m.DashboardPerformanceTab),
  { ssr: false, loading: ReportLoading }
)
const Overview = dynamic(
  () => import("./DashboardOverviewTab").then((m) => m.DashboardOverviewTab),
  { ssr: false, loading: ReportLoading }
)
const Analytics = dynamic(
  () => import("./DashboardAnalyticsTab").then((m) => m.DashboardAnalyticsTab),
  { ssr: false, loading: ReportLoading }
)
const Traffic = dynamic(
  () => import("@/app/components/dashboard/traffic-reports").then((m) => m.TrafficReports),
  { ssr: false, loading: ReportLoading }
)
const Sales = dynamic(
  () => import("@/app/components/dashboard/sales-reports").then((m) => m.SalesReports),
  { ssr: false, loading: ReportLoading }
)
const Costs = dynamic(
  () => import("@/app/components/dashboard/cost-reports").then((m) => m.CostReports),
  { ssr: false, loading: ReportLoading }
)
const Social = dynamic(
  () => import("@/app/components/dashboard/social-reports").then((m) => m.SocialReports),
  { ssr: false, loading: ReportLoading }
)

type ReportContentProps = {
  report: ReportId
  section: string
  siteId: string
  siteName?: string
  segmentName?: string
  startDate: Date
  endDate: Date
  segmentId: string
  t: (key: string) => string
}

export function ReportContent(props: ReportContentProps) {
  return <ReportExportScope report={props.report} section={props.section}
    siteId={props.siteId} siteName={props.siteName ?? props.siteId}
    segmentId={props.segmentId} segmentName={props.segmentName ?? props.segmentId}
    startDate={format(props.startDate, "yyyy-MM-dd")} endDate={format(props.endDate, "yyyy-MM-dd")}>
    <ReportLoadingScope report={props.report} section={props.section}>
      <SelectedReport {...props} />
    </ReportLoadingScope>
  </ReportExportScope>
}

function SelectedReport({ report, section, siteId, startDate, endDate, segmentId, t }: ReportContentProps) {
  const filters = { startDate, endDate, segmentId, t }
  switch (report) {
    case "performance": {
      const group = getReportSection(report, section)
      return <ReportDataProvider value={{ performanceGroup: group }}><Performance {...filters} section={group} /></ReportDataProvider>
    }
    case "overview": {
      const group = getReportSection(report, section)
      return <ReportDataProvider value={{ overviewGroup: group, performanceGroup: "outcomes" }}><Overview {...filters} section={group} /></ReportDataProvider>
    }
    case "analytics": return <Analytics {...filters} embedded section={getReportSection(report, section)} />
    case "traffic": return <Traffic {...filters} embedded siteId={siteId} section={getReportSection(report, section)} />
    case "sales": return <Sales {...filters} embedded section={getReportSection(report, section)} />
    case "costs": return <Costs {...filters} embedded section={getReportSection(report, section)} />
    case "social": return <Social {...filters} embedded section={getReportSection(report, section)} />
  }
}