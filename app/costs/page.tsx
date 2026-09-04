"use client"

import { MobileFiltersDrawer } from "@/app/components/ui/mobile-filters-drawer"

import React, { Suspense, useCallback, useEffect, useState } from "react"
import useSWR from "swr"
import { CostReports } from "@/app/components/dashboard/cost-reports"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { getSegments } from "@/app/segments/actions"
import { createClient } from "@/lib/supabase/client"
import { format, subMonths, startOfDay, endOfDay } from "date-fns"

function CostsPageContent() {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const today = new Date()
  const [selectedCampaign, setSelectedCampaign] = useState("all")
  const [selectedSegment, setSelectedSegment] = useState("all")
  const [dateRange, setDateRange] = useState<{ startDate: Date; endDate: Date }>({
    startDate: startOfDay(subMonths(today, 1)),
    endDate: endOfDay(today),
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
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, title")
        .eq("site_id", siteId)
        .order("title")
      if (error) throw new Error(error.message)
      return data || []
    }
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    const startDateParam = url.searchParams.get("startDate")
    const endDateParam = url.searchParams.get("endDate")
    const segmentParam = url.searchParams.get("segmentId")
    const campaignParam = url.searchParams.get("campaignId")

    if (startDateParam && endDateParam) {
      setDateRange({
        startDate: new Date(startDateParam),
        endDate: new Date(endDateParam),
      })
    }
    if (segmentParam) setSelectedSegment(segmentParam)
    if (campaignParam) setSelectedCampaign(campaignParam)
  }, [])

  const handleDateRangeChange = useCallback((startDate: Date, endDate: Date) => {
    setDateRange({ startDate, endDate })
  }, [])

  return (
    <div className="flex-1 min-w-0 w-full p-0 min-h-[calc(100dvh-var(--topbar-height,64px))] flex flex-col">
      <StickyHeader>
        <div className="w-full pt-0">
          <div className="flex w-full items-center justify-end gap-8">
            <MobileFiltersDrawer triggerText={t('common.filters') || "Filters"}>
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6 md:gap-4 w-full flex-1 md:justify-end min-w-0">
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {t("dashboard.filters.campaign") || "Campaign:"}
                    </span>
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
                  </div>
                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {t("dashboard.filters.segment") || "Segment:"}
                    </span>
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
                  </div>
                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                    <CalendarDateRangePicker
                      onRangeChange={handleDateRangeChange}
                      initialStartDate={dateRange.startDate}
                      initialEndDate={dateRange.endDate}
                      key={`date-range-${format(dateRange.startDate, "yyyy-MM-dd")}-${format(dateRange.endDate, "yyyy-MM-dd")}`}
                      className="flex items-center w-full md:w-auto" />
                  </div>
                </div>
              </div>
            </MobileFiltersDrawer>
          </div>
        </div>
      </StickyHeader>

      <div className="p-4 md:p-8 space-y-4 bg-muted/30 flex-1">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("costs.title") || "Costs"}</h2>
          <p className="text-muted-foreground">
            {t("costs.description") || "View and analyze your business costs in this report."}
          </p>
        </div>
        <CostReports
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          segmentId={selectedSegment}
          campaignId={selectedCampaign} />
      </div>
    </div>
  )
}

export default function CostsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading...
        </div>
      }
    >
      <CostsPageContent />
    </Suspense>
  )
}
