"use client"

import { MobileFiltersDrawer, FilterContainer, FilterSection } from "@/app/components/ui/mobile-filters-drawer"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { ReportExportButton } from "@/app/components/navigation/ReportExportButton"
import { format } from "date-fns"
import { ReportFilterSelect } from "./ReportFilterSelect"
import type { ReportOption } from "./use-report-filter"
import { REPORTS, type ReportId } from "./report-sections"

export function DashboardFilters({
  t,
  selectedSegment,
  onSegmentChange,
  onRequestSegments,
  retrySegments,
  segmentsDisabled,
  isLoadingSegments,
  segments,
  dateRange,
  onDateRangeChange,
  report,
  maxRangeDays,
  dateOptionsLoading = false,
}: {
  t: (key: string) => string
  selectedSegment: string
  onSegmentChange: (segmentId: string) => void
  onRequestSegments?: () => void
  retrySegments?: () => void
  segmentsDisabled?: boolean
  isLoadingSegments: boolean
  segments: ReportOption[]
  dateRange: { startDate: Date; endDate: Date }
  onDateRangeChange: (start: Date, end: Date) => void
  report: ReportId
  maxRangeDays?: number
  dateOptionsLoading?: boolean
}) {
  return (
    <StickyHeader>
      <div className="mx-auto w-full max-w-[1536px] min-w-0 py-2">
        <MobileFiltersDrawer triggerText={t("common.filters") || "Filters"} actions={<ReportExportButton />} mobileActionsBeforeDrawer tabs={
            <TabsList aria-label={`${REPORTS[report].title} sections`} className="justify-start bg-muted/50">
              {REPORTS[report].sections.map((section) => (
                <TabsTrigger key={section.id} value={section.id}>{section.label}</TabsTrigger>
              ))}
            </TabsList>
        }>
            <FilterContainer className="md:justify-end">
              {report !== "social" && report !== "traffic" && <FilterSection>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                  <ReportFilterSelect label="Segment" all={t("dashboard.filters.allSegments") || "All segments"}
                    value={selectedSegment} onChange={onSegmentChange} options={segments} loading={isLoadingSegments}
                    request={onRequestSegments} retry={retrySegments} disabled={segmentsDisabled} />
                </div>
              </FilterSection>}
              <FilterSection>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                  <CalendarDateRangePicker
                    iconOnly
                    onRangeChange={onDateRangeChange}
                    maxRangeDays={maxRangeDays}
                    disabled={dateOptionsLoading}
                    initialStartDate={dateRange.startDate}
                    initialEndDate={dateRange.endDate}
                    key={`date-range-${format(dateRange.startDate, "yyyy-MM-dd")}-${format(dateRange.endDate, "yyyy-MM-dd")}`}
                    className="flex items-center w-full md:w-auto"
                  />
                </div>
              </FilterSection>
            </FilterContainer>
        </MobileFiltersDrawer>
      </div>
    </StickyHeader>
  )
}
