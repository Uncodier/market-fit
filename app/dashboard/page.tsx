"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { RecentActivity } from "@/app/components/dashboard/recent-activity"
import { Overview } from "@/app/components/dashboard/overview"
import { SegmentDonut } from "@/app/components/dashboard/segment-donut"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"
import { CostReports } from "@/app/components/dashboard/cost-reports"
import { SalesReports } from "@/app/components/dashboard/sales-reports"
import { TrafficReports } from "@/app/components/dashboard/traffic-reports"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { HelpCircle } from "@/app/components/ui/icons"
import { useAuth } from "@/app/hooks/use-auth"
import { CohortTables } from "@/app/components/dashboard/cohort-tables"

import { LeadsCohortTables } from "@/app/components/dashboard/leads-cohort-tables"
import { useState, useEffect, useCallback } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { getSegments } from "@/app/segments/actions"
import { useSite } from "@/app/context/SiteContext"
import type { Segment } from "@/app/types/segments"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { RevenueWidget } from "@/app/components/dashboard/revenue-widget"
import { ActiveUsersWidget } from "@/app/components/dashboard/active-users-widget"
import { ActiveSegmentsWidget } from "@/app/components/dashboard/active-segments-widget"
import { ActiveCampaignsWidget } from "@/app/components/dashboard/active-campaigns-widget"
import { LTVWidget } from "@/app/components/dashboard/ltv-widget"
import { ROIWidget } from "@/app/components/dashboard/roi-widget"
import { CACWidget } from "@/app/components/dashboard/cac-widget"
import { CPLWidget } from "@/app/components/dashboard/cpl-widget"
import { format, subMonths, isAfter, isFuture } from "date-fns"
import { startOfMonth } from "date-fns"
import { isSameDay, isSameMonth } from "date-fns"
import { useRequestController } from "@/app/hooks/useRequestController"

export default function DashboardPage() {
  const { user } = useAuth()
  const { currentSite } = useSite()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const [segments, setSegments] = useState<Segment[]>([])
  const [selectedSegment, setSelectedSegment] = useState<string>("all")
  const [isLoadingSegments, setIsLoadingSegments] = useState(false)
  const { cancelAllRequests } = useRequestController()
  
  // Initialize dates and range type with safe values (one month ago to today) - ENHANCED
  const today = new Date()
  const oneMonthAgo = subMonths(today, 1)
  console.log(`[Dashboard] Initial state dates: ${format(oneMonthAgo, 'yyyy-MM-dd')} - ${format(today, 'yyyy-MM-dd')}`);
  const [selectedRangeType, setSelectedRangeType] = useState<string>("This month")
  const [dateRange, setDateRange] = useState<{ startDate: Date; endDate: Date }>({
    startDate: oneMonthAgo,
    endDate: today
  })
  const [formattedTotal, setFormattedTotal] = useState("")
  const [activeTab, setActiveTab] = useState("overview")
  const [isInitialized, setIsInitialized] = useState(false)

  // Determine the type of date range based on start and end dates
  const determineRangeType = useCallback((startDate: Date, endDate: Date) => {
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
  }, [])

  // Validates dates to ensure they're not in the future - ENHANCED
  const validateDates = useCallback((startDate: Date, endDate: Date) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    console.log(`[Dashboard] validateDates called with: ${format(startDate, 'yyyy-MM-dd')} - ${format(endDate, 'yyyy-MM-dd')}`);
    
    try {
      // FORCE dates to be in the past - no exceptions
      let safeStartDate = subMonths(now, 1); // Default to one month ago
      let safeEndDate = now; // Default to today
      
      // Ensure we have valid Date objects
      if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
        console.error("[Dashboard] Invalid start date:", startDate);
        // Use defaults already set above
      } else {
        // Check if the provided date is reasonable (not in future, not more than 2 years in past)
        const twoYearsAgo = subMonths(now, 24);
        
        if (startDate <= now && startDate >= twoYearsAgo) {
          safeStartDate = startDate;
        } else {
          console.warn(`[Dashboard] Start date out of reasonable range: ${format(startDate, 'yyyy-MM-dd')}, using one month ago`);
          // Keep the default
        }
      }
      
      if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
        console.error("[Dashboard] Invalid end date:", endDate);
        // Use defaults already set above
      } else {
        // End date must be today or in the past
        if (endDate <= now) {
          safeEndDate = endDate;
        } else {
          console.warn(`[Dashboard] End date is in the future: ${format(endDate, 'yyyy-MM-dd')}, using today`);
          // Keep the default (today)
        }
      }
      
      // Final safety check - if start date is after end date, adjust
      if (safeStartDate > safeEndDate) {
        console.warn(`[Dashboard] Start date after end date, creating proper range`);
        safeStartDate = subMonths(safeEndDate, 1);
      }
      
      console.log(`[Dashboard] Final validated date range: ${format(safeStartDate, 'yyyy-MM-dd')} - ${format(safeEndDate, 'yyyy-MM-dd')}`);
      return { startDate: safeStartDate, endDate: safeEndDate };
    } catch (error) {
      console.error("[Dashboard] Date validation error:", error);
      // Return absolutely safe defaults
      const safeDefaults = { 
        startDate: subMonths(now, 1),
        endDate: now
      };
      console.log(`[Dashboard] Using error fallback dates: ${format(safeDefaults.startDate, 'yyyy-MM-dd')} - ${format(safeDefaults.endDate, 'yyyy-MM-dd')}`);
      return safeDefaults;
    }
  }, []);

  // Handle date range change - ENHANCED
  const handleDateRangeChange = useCallback((startDate: Date, endDate: Date) => {
    console.log(`[Dashboard] handleDateRangeChange called with: ${format(startDate, 'yyyy-MM-dd')} - ${format(endDate, 'yyyy-MM-dd')}`);
    
    try {
      // ALWAYS validate dates before using them
      const validatedDates = validateDates(startDate, endDate);
      
      console.log(`[Dashboard] After validation: ${format(validatedDates.startDate, 'yyyy-MM-dd')} - ${format(validatedDates.endDate, 'yyyy-MM-dd')}`);
      
      // Avoid unnecessary state updates if no real changes
      if (isSameDay(validatedDates.startDate, dateRange.startDate) && 
          isSameDay(validatedDates.endDate, dateRange.endDate)) {
        console.log(`[Dashboard] No changes detected, skipping update`);
        return;
      }
      
      // Cancel all in-flight requests first to avoid race conditions
      cancelAllRequests();
      
      // Then update the date range
      setDateRange(validatedDates);
      determineRangeType(validatedDates.startDate, validatedDates.endDate);
      
      console.log(`[Dashboard] Date range state updated to: ${format(validatedDates.startDate, 'yyyy-MM-dd')} - ${format(validatedDates.endDate, 'yyyy-MM-dd')}`);
    } catch (error) {
      console.error("[Dashboard] Error handling date range change:", error);
      // Set to safe defaults if anything fails
      const now = new Date();
      const safeDefaults = {
        startDate: subMonths(now, 1),
        endDate: now
      };
      console.log(`[Dashboard] Using error fallback in handleDateRangeChange: ${format(safeDefaults.startDate, 'yyyy-MM-dd')} - ${format(safeDefaults.endDate, 'yyyy-MM-dd')}`);
      setDateRange(safeDefaults);
    }
  }, [cancelAllRequests, dateRange, determineRangeType, validateDates]);

  // Safety effect to detect and fix future dates that might slip through
  useEffect(() => {
    // Run this check only when dates are initialized and after any change
    if (isInitialized && dateRange.startDate && dateRange.endDate) {
      const now = new Date();
      let needsReset = false;
      
      // Check if either date is in the future
      if (isFuture(dateRange.startDate) || isFuture(dateRange.endDate)) {
        console.error(`[Dashboard] Future dates detected in initialized state: ${format(dateRange.startDate, 'yyyy-MM-dd')} - ${format(dateRange.endDate, 'yyyy-MM-dd')}`);
        needsReset = true;
      }
      
      // If future dates were somehow set, reset to safe values
      if (needsReset) {
        console.log('[Dashboard] Resetting to safe date range');
        
        // Cancel current requests
        cancelAllRequests();
        
        // Use safe dates
        const safeStartDate = subMonths(now, 1);
        const safeEndDate = now;
        
        // Reset the state
        setDateRange({
          startDate: safeStartDate,
          endDate: safeEndDate
        });
        
        // Update the range type
        determineRangeType(safeStartDate, safeEndDate);
      }
    }
  }, [isInitialized, dateRange.startDate, dateRange.endDate, cancelAllRequests, determineRangeType]);

  // Initialize date range when the component mounts - ENHANCED
  useEffect(() => {
    // Ensure we only run this initialization once
    if (!isInitialized) {
      try {
        console.log("[Dashboard] Initializing date range...");
        
        // Start with guaranteed safe values - always one month ago to today
        const now = new Date();
        const safeStartDate = subMonths(now, 1);
        const safeEndDate = now;
        
        console.log(`[Dashboard] Initial safe date range: ${format(safeStartDate, 'yyyy-MM-dd')} - ${format(safeEndDate, 'yyyy-MM-dd')}`);
        
        // ALWAYS validate even the initial safe dates
        const validatedDates = validateDates(safeStartDate, safeEndDate);
        
        console.log(`[Dashboard] After validation of initial dates: ${format(validatedDates.startDate, 'yyyy-MM-dd')} - ${format(validatedDates.endDate, 'yyyy-MM-dd')}`);
        
        // Set the state with validated values
        setDateRange(validatedDates);
        
        // Determine the range type based on these validated values
        determineRangeType(validatedDates.startDate, validatedDates.endDate);
        setIsInitialized(true);
        
        console.log(`[Dashboard] Dashboard initialized with date range: ${format(validatedDates.startDate, 'yyyy-MM-dd')} - ${format(validatedDates.endDate, 'yyyy-MM-dd')}`);
      } catch (error) {
        console.error("[Dashboard] Error initializing date range:", error);
        // Fallback to safe defaults in case of any error
        const now = new Date();
        const fallbackDates = {
          startDate: subMonths(now, 1),
          endDate: now
        };
        console.log(`[Dashboard] Using initialization fallback: ${format(fallbackDates.startDate, 'yyyy-MM-dd')} - ${format(fallbackDates.endDate, 'yyyy-MM-dd')}`);
        setDateRange(fallbackDates);
        setIsInitialized(true);
      }
    }
  }, [isInitialized, determineRangeType, validateDates]);

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

  // Handle segment change
  const handleSegmentChange = (newSegmentId: string) => {
    // Cancel all in-flight requests when segment changes
    cancelAllRequests();
    setSelectedSegment(newSegmentId);
  }

  // Update formattedTotal when revenue data changes
  const handleTotalUpdate = useCallback((total: string) => {
    setFormattedTotal(total);
  }, []);

  // Reset states when tab changes
  const handleTabChange = (newTab: string) => {
    if (newTab !== activeTab) {
      console.log(`[Dashboard] Changing tab from ${activeTab} to ${newTab}, cancelling all requests`);
      cancelAllRequests();
      setActiveTab(newTab);
      setFormattedTotal(""); // Reset formatted total when changing tabs
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
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  <TabsTrigger value="traffic">Traffic</TabsTrigger>
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
                  key={`date-range-${format(dateRange.startDate, 'yyyy-MM-dd')}-${format(dateRange.endDate, 'yyyy-MM-dd')}`}
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
                Welcome to your control panel - Viewing {selectedRangeType} data ({format(dateRange.startDate, "MMMM d")} to {format(dateRange.endDate, "MMMM d")} {format(dateRange.endDate, "yyyy")})
              </p>
            </div>
          </div>
        </div>

        <div className="px-16">
          <TabsContent value="overview" className="space-y-4">
            {activeTab === "overview" && (
              <>
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
                  <ActiveCampaignsWidget
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
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
                  <Card className="col-span-1">
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
                  <Card className="col-span-1">
                    <CardHeader>
                      <CardTitle>Recent commercial activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="min-h-[200px]">
                        <RecentActivity 
                          limit={5}
                          startDate={dateRange.startDate}
                          endDate={dateRange.endDate} 
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
          <TabsContent value="analytics" className="space-y-4">
            {activeTab === "analytics" && (
              <>
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
                        onTotalUpdate={handleTotalUpdate}
                      />
                    </CardContent>
                  </Card>
                </div>
                <div className="grid gap-4 grid-cols-1">
                  <Card>
                    <CardHeader>
                      <CardTitle>Cohort Analysis</CardTitle>
                      <CardDescription>
                        Week-to-week retention metrics for sales and usage cohorts (standardized).
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
                  <Card>
                    <CardHeader>
                      <CardTitle>Lead Cohort Analysis</CardTitle>
                      <CardDescription>
                        Week-to-week lead retention metrics - tracking lead engagement over time (standardized).
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <LeadsCohortTables
                        segmentId={selectedSegment}
                        startDate={dateRange.startDate}
                        endDate={dateRange.endDate}
                      />
                    </CardContent>
                  </Card>

                </div>
              </>
            )}
          </TabsContent>
          <TabsContent value="traffic" className="space-y-4">
            {activeTab === "traffic" && currentSite && (
              <TrafficReports 
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
                segmentId={selectedSegment}
                siteId={currentSite.id}
              />
            )}
          </TabsContent>
          <TabsContent value="costs" className="space-y-4">
            {activeTab === "costs" && (
              <CostReports 
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
                segmentId={selectedSegment}
              />
            )}
          </TabsContent>
          <TabsContent value="sales" className="space-y-4">
            {activeTab === "sales" && (
              <SalesReports 
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
                segmentId={selectedSegment}
              />
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
} 