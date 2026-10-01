"use client"

import type { PostgrestSingleResponse } from "@supabase/supabase-js"
import { MobileFiltersDrawer, FilterContainer, FilterSection } from "@/app/components/ui/mobile-filters-drawer"

import React, { Suspense, useCallback, useState } from "react"
import useSWR from "swr"
import { useSearchParams } from "next/navigation"
import { CostReports } from "@/app/components/dashboard/cost-reports"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { ReportExportButton } from "@/app/components/navigation/ReportExportButton"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { getSegments } from "@/app/segments/actions"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { REPORTS, getReportSection } from "@/app/dashboard/report-sections"
import { ReportSWRScope } from "@/app/dashboard/ReportSWRScope"
import { ReportExportScope } from "@/app/dashboard/export/ReportExportScope"
import { createClient } from "@/lib/supabase/client"
import { format, isValid, subMonths, startOfDay, endOfDay } from "date-fns"

function CostsPageContent() {
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const section = getReportSection("costs", searchParams.get("section"))
  const selectedSection = REPORTS.costs.sections.find(item => item.id === section)!
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const [selectedCampaign, setSelectedCampaign] = useState(() => searchParams.get("campaignId") || "all")
  const [selectedSegment, setSelectedSegment] = useState(() => searchParams.get("segmentId") || "all")
  const [dateRange, setDateRange] = useState(() => {
    const start = new Date(searchParams.get("startDate") || "")
    const end = new Date(searchParams.get("endDate") || "")
    if (isValid(start) && isValid(end) && start <= end) return { startDate: start, endDate: end }
    const today = new Date()
    return { startDate: startOfDay(subMonths(today, 1)), endDate: endOfDay(today) }
  })

  const siteKey = currentSite && currentSite.id !== "default" ? currentSite.id : null

  const { data: segments = [], isLoading: isLoadingSegments } = useSWR(
    siteKey ? ["segments", siteKey] : null,
    async ([, siteId]) => {
      const result = await getSegments(siteId)
      if (result.error) throw new Error(result.error)
      return result.segments || []
    }
  )

  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useSWR(
    siteKey ? ["campaigns-lite", siteKey] : null,
    async ([, siteId]) => {
      const supabase = createClient()
      const { data, error }: PostgrestSingleResponse<Array<{ id: string; title: string }>> = await supabase
        .from("campaigns")
        .select("id, title")
        .eq("site_id", siteId)
        .order("title")
      if (error) throw new Error(error.message)
      return data || []
    }
  )

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
            <MobileFiltersDrawer triggerText={t('common.filters') || "Filters"}>
              <FilterContainer className="md:justify-end">
                <FilterSection title={t("dashboard.filters.campaign") || "Campaign"}>
                  <Select
                    value={selectedCampaign}
                    onValueChange={setSelectedCampaign}
                    disabled={isLoadingCampaigns}
                  >
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder={t("dashboard.filters.allCampaigns") || "All campaigns"} />
                    </SelectTrigger>
                    <SelectContent className="min-w-[180px] w-auto">
                      <SelectItem value="all">
                        {t("dashboard.filters.allCampaigns") || "All campaigns"}
                      </SelectItem>
                      {campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterSection>
                    
                    <FilterSection title={t("dashboard.filters.segment") || "Segment"}>
                  <Select
                    value={selectedSegment}
                    onValueChange={setSelectedSegment}
                    disabled={isLoadingSegments}
                  >
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder={t("dashboard.filters.allSegments") || "All segments"} />
                    </SelectTrigger>
                    <SelectContent className="min-w-[180px] w-auto">
                      <SelectItem value="all">
                        {t("dashboard.filters.allSegments") || "All segments"}
                      </SelectItem>
                      {segments.map((segment) => (
                        <SelectItem key={segment.id} value={segment.id}>
                          {segment.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
        <ReportExportScope key={`${siteKey}:${selectedCampaign}`} report="costs" section={section}
          siteId={siteKey ?? ""} siteName={currentSite?.name ?? ""}
          segmentId={selectedSegment} segmentName={selectedSegment === "all"
            ? "All segments" : segments.find(item => item.id === selectedSegment)?.name ?? selectedSegment}
          startDate={format(dateRange.startDate, "yyyy-MM-dd")} endDate={format(dateRange.endDate, "yyyy-MM-dd")}>
          <CostReports
          key={`${siteKey}:${selectedSegment}:${selectedCampaign}:${dateRange.startDate.getTime()}:${dateRange.endDate.getTime()}`}
          section={section}
          embedded
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          segmentId={selectedSegment}
          campaignId={selectedCampaign} />
        </ReportExportScope>
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
