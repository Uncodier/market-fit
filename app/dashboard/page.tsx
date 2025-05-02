"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { RecentActivity } from "@/app/components/dashboard/recent-activity"
import { Overview } from "@/app/components/dashboard/overview"
import { SegmentDonut } from "@/app/components/dashboard/segment-donut"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"
import { CostReports } from "@/app/components/dashboard/cost-reports"
import { SalesReports } from "@/app/components/dashboard/sales-reports"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { HelpCircle } from "@/app/components/ui/icons"
import { useAuth } from "@/app/hooks/use-auth"
import { CohortTables } from "@/app/components/dashboard/cohort-tables"
import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { getSegments } from "@/app/segments/actions"
import { useSite } from "@/app/context/SiteContext"
import type { Segment } from "@/app/types/segments"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { RevenueWidget } from "@/app/components/dashboard/revenue-widget"
import { ActiveUsersWidget } from "@/app/components/dashboard/active-users-widget"
import { ActiveSegmentsWidget } from "@/app/components/dashboard/active-segments-widget"
import { ActiveExperimentsWidget } from "@/app/components/dashboard/active-experiments-widget"
import { LTVWidget } from "@/app/components/dashboard/ltv-widget"
import { ROIWidget } from "@/app/components/dashboard/roi-widget"
import { CACWidget } from "@/app/components/dashboard/cac-widget"
import { CPLWidget } from "@/app/components/dashboard/cpl-widget"
import { format } from "date-fns"
import { startOfMonth } from "date-fns"
import { isSameDay, isSameMonth } from "date-fns"
import { useState as useFormatState } from "react"
import { useRequestController } from "@/app/hooks/useRequestController"

export default function DashboardPage() {
  const { user } = useAuth()
  const { currentSite } = useSite()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const [segments, setSegments] = useState<Segment[]>([])
  const [selectedSegment, setSelectedSegment] = useState<string>("all")
  const [isLoadingSegments, setIsLoadingSegments] = useState(false)
  const { cancelAllRequests } = useRequestController()
  
  // Initialize dates and range type
  const today = new Date()
  const firstDayOfMonth = startOfMonth(today)
  const [selectedRangeType, setSelectedRangeType] = useState<string>("This month")
  const [dateRange, setDateRange] = useState<{ startDate: Date; endDate: Date }>({
    startDate: firstDayOfMonth,
    endDate: today
  })
  const [formattedTotal, setFormattedTotal] = useFormatState("");
  const [activeTab, setActiveTab] = useState("overview")

  // Initialize date range when the component mounts
  useEffect(() => {
    determineRangeType(firstDayOfMonth, today);
  }, []);

  useEffect(() => {
    const loadSegments = async () => {
      if (!currentSite || currentSite.id === "default") return

      setIsLoadingSegments(true)
      try {
        const result = await getSegments(currentSite.id)
        if (result.segments) {
          setSegments(result.segments)
        }
      } catch (error) {
        console.error("Error loading segments:", error)
      } finally {
        setIsLoadingSegments(false)
      }
    }

    loadSegments()
  }, [currentSite])

  // Determine the type of date range based on start and end dates
  const determineRangeType = (startDate: Date, endDate: Date) => {
    const today = new Date()
    const monthStart = startOfMonth(today)
    
    if (isSameDay(startDate, today) && isSameDay(endDate, today)) {
      setSelectedRangeType("Today")
    } else if (
      isSameDay(startDate, monthStart) && 
      isSameMonth(startDate, today) && 
      isSameDay(endDate, today)
    ) {
      setSelectedRangeType("This month")
    } else {
      setSelectedRangeType("Custom range")
    }
  }

  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    // Evitar actualizaciones de estado innecesarias si no hay cambios reales
    if (isSameDay(startDate, dateRange.startDate) && isSameDay(endDate, dateRange.endDate)) {
      return;
    }
    
    // Cancel all in-flight requests first to avoid race conditions
    cancelAllRequests();
    
    // Then update the date range
    setDateRange({ startDate, endDate });
    determineRangeType(startDate, endDate);
  }

  // Handle segment change
  const handleSegmentChange = (newSegmentId: string) => {
    // Cancel all in-flight requests when segment changes
    cancelAllRequests();
    setSelectedSegment(newSegmentId);
  }

  // Handle tab changes - cancel all pending requests
  const handleTabChange = (newTab: string) => {
    // If tab actually changed, cancel all pending requests
    if (newTab !== activeTab) {
      console.log(`[Dashboard] Changing tab from ${activeTab} to ${newTab}, cancelling all requests`);
      cancelAllRequests();
      setActiveTab(newTab);
    }
  }

  return (
    <div className="flex-1 p-0">
      <Tabs 
        defaultValue="overview" 
        className="space-y-4"
        value={activeTab}
        onValueChange={handleTabChange}
      >
        <StickyHeader showAIButton={false}>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  <TabsTrigger value="costs">Cost Reports</TabsTrigger>
                  <TabsTrigger value="sales">Sales Reports</TabsTrigger>
                </TabsList>
              </div>
              <div className="ml-auto flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Segment:</span>
                  <Select 
                    value={selectedSegment} 
                    onValueChange={handleSegmentChange}
                    disabled={isLoadingSegments}
                  >
                    <SelectTrigger className="w-[180px]">
                      <div className="flex-1 overflow-hidden">
                        <span style={{ pointerEvents: 'none' }}>
                          <SelectValue placeholder="All segments" />
                        </span>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="min-w-[180px] w-auto">
                      <SelectItem 
                        value="all"
                        className="flex-wrap whitespace-normal"
                      >
                        <span style={{ pointerEvents: 'none' }}>All segments</span>
                      </SelectItem>
                      {segments.map((segment) => (
                        <SelectItem 
                          key={segment.id} 
                          value={segment.id}
                          className="flex-wrap whitespace-normal"
                        >
                          <span style={{ pointerEvents: 'none' }}>{segment.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <CalendarDateRangePicker 
                  onRangeChange={handleDateRangeChange} 
                  initialStartDate={dateRange.startDate}
                  initialEndDate={dateRange.endDate}
                />
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className="px-16 pt-3 pb-4">
          <div className="flex items-center justify-between space-x-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Hi, {userName}! 👋</h2>
              <p className="text-muted-foreground">
                Welcome to your control panel - Viewing {selectedRangeType} data ({format(dateRange.startDate, "MMMM d")} to {format(dateRange.endDate, "MMMM d, yyyy")})
              </p>
            </div>
          </div>
        </div>

        <div className="px-16">
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 min-h-[160px]">
              <RevenueWidget 
                segmentId={selectedSegment}
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
              />
              <ActiveUsersWidget
                segmentId={selectedSegment}
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
              />
              <ActiveSegmentsWidget
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
              />
              <ActiveExperimentsWidget
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
              />
              <LTVWidget
                segmentId={selectedSegment}
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
              />
              <CACWidget
                segmentId={selectedSegment}
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
              />
              <ROIWidget
                segmentId={selectedSegment}
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
              />
              <CPLWidget
                segmentId={selectedSegment}
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
              />
            </div>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>Overview</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  <div className="min-h-[350px]">
                    <Overview 
                      startDate={dateRange.startDate}
                      endDate={dateRange.endDate}
                      segmentId={selectedSegment}
                    />
                  </div>
                </CardContent>
              </Card>
              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Recent commercial activity</CardTitle>
                  <CardDescription>
                    Completed lead tasks and user interactions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="min-h-[200px]">
                    <RecentActivity />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 min-h-[160px]">
              <Card className="col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Clients by Segment</CardTitle>
                  <CardDescription className="text-xs">
                    Distribution of clients across segments
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <SegmentDonut
                    segmentId={selectedSegment}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                    endpoint="clients-by-segment"
                  />
                </CardContent>
              </Card>
              <Card className="col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Revenue by Segment</CardTitle>
                  <CardDescription className="text-xs">
                    Distribution of revenue across segments
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <SegmentDonut
                    segmentId={selectedSegment}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                    endpoint="revenue-by-segment"
                    formatValues={true}
                  />
                </CardContent>
              </Card>
              <Card className="col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Clients by Campaign</CardTitle>
                  <CardDescription className="text-xs">
                    Distribution of clients across campaigns
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <SegmentDonut
                    segmentId={selectedSegment}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                    endpoint="clients-by-campaign"
                  />
                </CardContent>
              </Card>
              <Card className="col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Revenue by Campaign</CardTitle>
                  <CardDescription className="text-xs">
                    Revenue across campaigns{formattedTotal ? ` - ${formattedTotal}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <SegmentDonut
                    segmentId={selectedSegment}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                    endpoint="revenue-by-campaign"
                    formatValues={true}
                    onTotalUpdate={(total) => setFormattedTotal(total)}
                  />
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 grid-cols-1">
              <Card>
                <CardHeader>
                  <CardTitle>Cohort Analysis</CardTitle>
                  <CardDescription>
                    Weekly retention metrics for sales and usage cohorts.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CohortTables
                    segmentId={selectedSegment}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="costs" className="space-y-4">
            <CostReports 
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              segmentId={selectedSegment}
            />
          </TabsContent>
          <TabsContent value="sales" className="space-y-4">
            <SalesReports 
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              segmentId={selectedSegment}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
} 