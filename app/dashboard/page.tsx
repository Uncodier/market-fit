"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { RecentActivity } from "@/app/components/dashboard/recent-activity"
import { Overview } from "@/app/components/dashboard/overview"
import { SegmentMetrics } from "@/app/components/dashboard/segment-metrics"
import { CampaignRevenueDonut, formattedRevenueTotal } from "@/app/components/dashboard/campaign-revenue-donut"
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

export default function DashboardPage() {
  const { user } = useAuth()
  const { currentSite } = useSite()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const [segments, setSegments] = useState<Segment[]>([])
  const [selectedSegment, setSelectedSegment] = useState<string>("all")
  const [isLoadingSegments, setIsLoadingSegments] = useState(false)
  const [selectedRangeType, setSelectedRangeType] = useState<string>("This month")
  const [dateRange, setDateRange] = useState<{ startDate: Date; endDate: Date }>({
    startDate: startOfMonth(new Date()),
    endDate: new Date()
  })

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

  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    setDateRange({ startDate, endDate })
    
    // Determine range type based on dates
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

  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="overview" className="space-y-4">
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
                    onValueChange={setSelectedSegment}
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
                <CalendarDateRangePicker onRangeChange={handleDateRangeChange} />
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
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>Segment Metrics</CardTitle>
                  <CardDescription>
                    Segment performance metrics for the last 30 days.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  <SegmentMetrics />
                </CardContent>
              </Card>
              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Revenue by Campaign</CardTitle>
                  <CardDescription>
                    Distribution of revenue across marketing campaigns - {formattedRevenueTotal}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CampaignRevenueDonut />
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
                  <CohortTables />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="costs" className="space-y-4">
            <CostReports />
          </TabsContent>
          <TabsContent value="sales" className="space-y-4">
            <SalesReports />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
} 