"use client"

import { MobileFiltersDrawer } from "@/app/components/ui/mobile-filters-drawer"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { format } from "date-fns"
import type { Segment } from "@/app/types/segments"

export function DashboardFilters({
  t,
  selectedSegment,
  onSegmentChange,
  isLoadingSegments,
  segments,
  dateRange,
  onDateRangeChange,
}: {
  t: (key: string) => string
  selectedSegment: string
  onSegmentChange: (segmentId: string) => void
  isLoadingSegments: boolean
  segments: Segment[]
  dateRange: { startDate: Date; endDate: Date }
  onDateRangeChange: (start: Date, end: Date) => void
}) {
  return (
    <StickyHeader>
      <div className="w-full pt-0">
        <div className="flex w-full items-center justify-end gap-8">
          <MobileFiltersDrawer triggerText={t("common.filters") || "Filters"}>
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6 md:gap-4 w-full flex-1 md:justify-end min-w-0">
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t("dashboard.filters.segment") || "Segment:"}</span>
                  <Select
                    value={selectedSegment}
                    onValueChange={onSegmentChange}
                    disabled={isLoadingSegments}
                  >
                    <SelectTrigger className="w-full md:w-[180px]">
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
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                  <CalendarDateRangePicker
                    onRangeChange={onDateRangeChange}
                    initialStartDate={dateRange.startDate}
                    initialEndDate={dateRange.endDate}
                    key={`date-range-${format(dateRange.startDate, "yyyy-MM-dd")}-${format(dateRange.endDate, "yyyy-MM-dd")}`}
                    className="flex items-center w-full md:w-auto"
                  />
                </div>
              </div>
            </div>
          </MobileFiltersDrawer>
        </div>
      </div>
    </StickyHeader>
  )
}
