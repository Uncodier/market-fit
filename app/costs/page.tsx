"use client"

import { MobileFiltersDrawer, FilterContainer, FilterSection } from "@/app/components/ui/mobile-filters-drawer"

import React, { Suspense, useCallback, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CostReports } from "@/app/components/dashboard/cost-reports"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { ReportExportButton } from "@/app/components/navigation/ReportExportButton"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useFinanceWorkspace } from "@/app/finance/use-finance-workspace"
import { useReportFilter } from "@/app/dashboard/use-report-filter"
import { ReportFilterSelect } from "@/app/dashboard/ReportFilterSelect"
import { ReportLoading } from "@/app/dashboard/ReportLoading"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { REPORTS, getReportSection } from "@/app/dashboard/report-sections"
import { ReportSWRScope } from "@/app/dashboard/ReportSWRScope"
import { ReportExportScope } from "@/app/dashboard/export/ReportExportScope"
import { format, isValid, subMonths, startOfDay, endOfDay } from "date-fns"

function CostsPageContent() {
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const section = getReportSection("costs", searchParams.get("section"))
  const selectedSection = REPORTS.costs.sections.find(item => item.id === section)!
  const { t } = useLocalization()
  const workspace = useFinanceWorkspace()
  const { currentSite } = workspace
  const campaigns = useReportFilter('campaigns', workspace, searchParams.get("campaignId") || "all")
  const segments = useReportFilter('segments', workspace, searchParams.get("segmentId") || "all")
  const selectedCampaign = campaigns.value
  const selectedSegment = segments.value
  const [dateRange, setDateRange] = useState(() => {
    const start = new Date(searchParams.get("startDate") || "")
    const end = new Date(searchParams.get("endDate") || "")
    if (isValid(start) && isValid(end) && start <= end) return { startDate: start, endDate: end }
    const today = new Date()
    return { startDate: startOfDay(subMonths(today, 1)), endDate: endOfDay(today) }
  })

  const siteKey = currentSite && currentSite.id !== "default" ? currentSite.id : null

  const handleDateRangeChange = useCallback((startDate: Date, endDate: Date) => {
    setDateRange({ startDate, endDate })
  }, [])

  const handleSectionChange = (value: string) => {
    if (value === section) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("section", getReportSection("costs", value))
    window.history.pushState(null, "", `/costs?${params.toString()}`)
  }

  return (
    <Tabs value={section} onValueChange={handleSectionChange} className="flex-1 min-w-0 w-full p-0 min-h-[calc(100dvh-var(--topbar-height,64px))] flex flex-col">
      <StickyHeader>
        <div className="mx-auto w-full max-w-[1536px] min-w-0 py-2">
          <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 max-w-full flex-1 overflow-x-auto">
              <TabsList aria-label="Costs sections" className="justify-start bg-muted/50">
                {REPORTS.costs.sections.map(item => <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>)}
              </TabsList>
            </div>
            <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
            <MobileFiltersDrawer key={workspace.key} triggerText={t('common.filters') || "Filters"}>
              <FilterContainer className="md:justify-end">
                <FilterSection title={t("dashboard.filters.campaign") || "Campaign"}>
                  <ReportFilterSelect label="Campaign" all={t("dashboard.filters.allCampaigns") || "All campaigns"} {...campaigns} />
                </FilterSection>
                    
                    <FilterSection title={t("dashboard.filters.segment") || "Segment"}>
                  <ReportFilterSelect label="Segment" all={t("dashboard.filters.allSegments") || "All segments"} {...segments} />
                </FilterSection>
                    
                <FilterSection title={t('common.dateRange') || 'Date Range'}>
                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                    {!isMobile && <ReportExportButton />}
                    <CalendarDateRangePicker
                      onRangeChange={handleDateRangeChange}
                      initialStartDate={dateRange.startDate}
                      initialEndDate={dateRange.endDate}
                      key={`date-range-${format(dateRange.startDate, "yyyy-MM-dd")}-${format(dateRange.endDate, "yyyy-MM-dd")}`}
                      className="flex items-center w-full md:w-auto" />
                  </div>
                </FilterSection>
              </FilterContainer>
            </MobileFiltersDrawer>
            {isMobile && <ReportExportButton />}
            </div>
          </div>
        </div>
      </StickyHeader>

      <TabsContent value={section} className="m-0 bg-muted/20 flex-1 min-w-0">
      <div data-report-viewport className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-5 md:px-8 md:py-6">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Costs</h1>
          <p className="text-sm leading-relaxed text-muted-foreground max-w-3xl">{selectedSection.description}</p>
        </header>
        {workspace.loading ? <ReportLoading report="costs" section={section} /> : !workspace.ready ? (
          <p role="status">Select a workspace to view cost reports.</p>
        ) : <ReportExportScope key={`${workspace.key}:${selectedCampaign}`} report="costs" section={section}
          siteId={siteKey ?? ""} siteName={currentSite?.name ?? ""}
          segmentId={selectedSegment} segmentName={selectedSegment === "all"
            ? "All segments" : segments.options.find(item => item.id === selectedSegment)?.name ?? selectedSegment}
          startDate={format(dateRange.startDate, "yyyy-MM-dd")} endDate={format(dateRange.endDate, "yyyy-MM-dd")}>
          <CostReports
          key={`${siteKey}:${selectedSegment}:${selectedCampaign}:${dateRange.startDate.getTime()}:${dateRange.endDate.getTime()}`}
          section={section}
          embedded
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          segmentId={selectedSegment}
          campaignId={selectedCampaign} />
        </ReportExportScope>}
      </div>
      </TabsContent>
    </Tabs>
  )
}

export default function CostsPage() {
  return (
    <ReportSWRScope><Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading...
        </div>
      }
    >
      <CostsPageContent />
    </Suspense></ReportSWRScope>
  )
}
