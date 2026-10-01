"use client"

import { MobileFiltersDrawer, FilterContainer, FilterSection } from "@/app/components/ui/mobile-filters-drawer"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { ReportExportButton } from "@/app/components/navigation/ReportExportButton"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { format } from "date-fns"
import type { Segment } from "@/app/types/segments"
import { REPORTS, type ReportId } from "./report-sections"

export function DashboardFilters({
  t,
  selectedSegment,
  onSegmentChange,
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
  isLoadingSegments: boolean
  segments: Segment[]
  dateRange: { startDate: Date; endDate: Date }
  onDateRangeChange: (start: Date, end: Date) => void
  report: ReportId
  maxRangeDays?: number
  dateOptionsLoading?: boolean
}) {
  const isMobile = useIsMobile()

  return (
    <StickyHeader>
      <div className="mx-auto w-full max-w-[1536px] min-w-0 py-2">
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 max-w-full flex-1 overflow-x-auto">
            <TabsList aria-label={`${REPORTS[report].title} sections`} className="justify-start bg-muted/50">
              {REPORTS[report].sections.map((section) => (
                <TabsTrigger key={section.id} value={section.id}>{section.label}</TabsTrigger>
              ))}
            </TabsList>
          </div>
          <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
          <MobileFiltersDrawer triggerText={t("common.filters") || "Filters"}>
            <FilterContainer className="md:justify-end">
              {report !== "social" && report !== "traffic" && <FilterSection>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t("dashboard.filters.segment") || "Segment:"}</span>
                  <Select
                    value={selectedSegment}
                    onValueChange={onSegmentChange}
                    disabled={isLoadingSegments}
                  >
                    <SelectTrigger aria-label="Segment" className="w-full md:w-[180px]">
                      <div className="flex-1 overflow-hidden">
                        <span style={{ pointerEvents: "none" }}>
                          <SelectValue placeholder={t("dashboard.filters.allSegments") || "All segments"} />
                        </span>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="min-w-[180px] w-auto">
                      <SelectItem value="all" className="flex-wrap whitespace-normal">
                        <span style={{ pointerEvents: "none" }}>{t("dashboard.filters.allSegments") || "All segments"}</span>
                      </SelectItem>
                      {segments.map((segment) => (
                        <SelectItem key={segment.id} value={segment.id} className="flex-wrap whitespace-normal">
                          <span style={{ pointerEvents: "none" }}>{segment.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </FilterSection>}
              <FilterSection>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                  {!isMobile && <ReportExportButton />}
                  <CalendarDateRangePicker
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
          {isMobile && <ReportExportButton />}
          </div>
        </div>
      </div>
    </StickyHeader>
  )
}
