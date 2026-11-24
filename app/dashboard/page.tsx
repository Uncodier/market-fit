"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { endOfDay, startOfDay, subDays } from "date-fns"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useFinanceWorkspace } from "@/app/finance/use-finance-workspace"
import { useReportFilter } from "./use-report-filter"
import { usePageRefreshPrevention } from "@/app/hooks/use-prevent-refresh"
import { Tabs, TabsContent } from "@/app/components/ui/tabs"
import { Button } from "@/app/components/ui/button"
import { DashboardFilters } from "./DashboardFilters"
import { ReportContent } from "./ReportContent"
import { ReportLoading } from "./ReportLoading"
import { ReportSWRScope } from "./ReportSWRScope"
import { REPORTS, getReportSection, isReportId, reportSectionUrl } from "./report-sections"
import { defaultReportRange, reportRangeError } from "./report-range"
import { useReportDateLimits } from "./use-report-date-limits"
import DashboardLoading from "./loading"

function DashboardPageContent() {
  const { t } = useLocalization()
  const workspace = useFinanceWorkspace()
  const { currentSite } = workspace
  const searchParams = useSearchParams()
  const router = useRouter()
  const { shouldPreventRefresh } = usePageRefreshPrevention()
  const reportParam = searchParams.get("tab")
  const report = isReportId(reportParam) ? reportParam : "performance"
  const section = getReportSection(report, searchParams.get("section"))
  const definition = REPORTS[report]
  const selectedSection = definition.sections.find((item) => item.id === section)!
  const previousReport = useRef(report)
  const siteId = currentSite?.id
  const supportsSegments = report !== "social" && report !== "traffic"
  const segments = useReportFilter('segments', workspace, 'all', supportsSegments)
  const selectedSegment = supportsSegments ? segments.value : "all"
  const [dateRange, setDateRange] = useState(() => defaultReportRange())
  const dateLimits = useReportDateLimits(workspace.ready ? siteId : undefined, report, section)
  const rangeError = reportRangeError(dateRange.startDate, dateRange.endDate, dateLimits.maxRangeDays)

  useEffect(() => {
    if (reportParam === "onboarding") router.replace("/onboarding")
    else if (reportParam && !isReportId(reportParam)) router.replace("/dashboard")
    if (previousReport.current !== report) {
      previousReport.current = report
      window.dispatchEvent(new CustomEvent("dashboard:tabchange", { detail: { activeTab: report } }))
    }
  }, [report, reportParam, router])

  const handleDateRangeChange = useCallback((startDate: Date, endDate: Date) => {
    if (!reportRangeError(startDate, endDate)) setDateRange({ startDate: startOfDay(startDate), endDate: endOfDay(endDate) })
  }, [])

  const handleSectionChange = (next: string) => {
    if (next === section || shouldPreventRefresh) return
    // Native history integrates with Next navigation without a server round trip.
    window.history.pushState(null, "", reportSectionUrl(searchParams.toString(), report, next))
  }

  return (
    <Tabs key={report} value={section} onValueChange={handleSectionChange}
      className="flex-1 min-w-0 w-full min-h-[calc(100dvh-var(--topbar-height,64px))] flex flex-col">
      {shouldPreventRefresh && (
        <div role="status" className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <p className="text-sm text-yellow-700">Navigation is temporarily blocked to protect your work. Please wait for the current operation to complete.</p>
        </div>
      )}
      <DashboardFilters
        report={report}
        t={t}
        selectedSegment={selectedSegment}
        key={workspace.key}
        onSegmentChange={segments.onChange}
        onRequestSegments={segments.request}
        retrySegments={segments.retry}
        segmentsDisabled={segments.disabled}
        isLoadingSegments={segments.loading}
        segments={segments.options}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        maxRangeDays={dateLimits.maxRangeDays}
        dateOptionsLoading={!workspace.ready || dateLimits.isLoading || !dateLimits.maxRangeDays}
      />
      <TabsContent value={section} className="m-0 bg-muted/20 flex-1 min-w-0">
        <div data-report-viewport className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-5 md:px-8 md:py-6">
        <p className="text-sm leading-relaxed text-muted-foreground max-w-3xl">{selectedSection.description}</p>
        {workspace.loading ? <ReportLoading report={report} section={section} /> : siteId && siteId !== "default" ? dateLimits.isLoading || dateLimits.isValidating ? (
          <ReportLoading report={report} section={section} />
        ) : dateLimits.error ? (
          <div role="alert" className="rounded-lg border bg-background p-5 space-y-3">
            <p className="text-sm">{dateLimits.error.message}</p>
            <Button variant="outline" onClick={() => { void dateLimits.mutate() }}>Retry date options</Button>
          </div>
        ) : dateLimits.signedOut || !workspace.ready ? <p role="status" className="text-sm text-muted-foreground">Sign in to view reports.</p>
        : !dateLimits.maxRangeDays ? <ReportLoading report={report} section={section} /> : rangeError ? (
          <div role="alert" className="rounded-lg border bg-background p-5 space-y-3">
            <p className="text-sm">{rangeError}</p>
            <Button variant="outline" onClick={() => setDateRange({ startDate: startOfDay(subDays(dateRange.endDate, Math.min(30, dateLimits.maxRangeDays!) - 1)), endDate: dateRange.endDate })}>
              Use last {Math.min(30, dateLimits.maxRangeDays)} days of this range
            </Button>
          </div>
        ) : (
            <ReportContent key={`${workspace.key}:${selectedSegment}:${dateRange.startDate.getTime()}:${dateRange.endDate.getTime()}`}
              report={report} section={section} siteId={siteId} t={t}
              siteName={currentSite.name}
              segmentName={selectedSegment === "all" ? "All segments" : segments.options.find(item => item.id === selectedSegment)?.name ?? selectedSegment}
              segmentId={selectedSegment} {...dateRange} />
        ) : <p className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">Select a site to view reports.</p>}
        </div>
      </TabsContent>
    </Tabs>
  )
}

export default function DashboardPage() {
  return <ReportSWRScope><Suspense fallback={<DashboardLoading />}><DashboardPageContent /></Suspense></ReportSWRScope>
}