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
import OnboardingItinerary from "@/app/components/dashboard/onboarding-itinerary"
import { useProfile } from "@/app/hooks/use-profile"
import { createClient } from "@/lib/supabase/client"
import { usePageRefreshPrevention } from "@/app/hooks/use-prevent-refresh"
import { useContextEntities } from "@/app/hooks/use-context-entities"
import { TasksWidget } from "@/app/components/dashboard/tasks-widget"
import { ConversationsWidget } from "@/app/components/dashboard/conversations-widget"
import { ContentsApprovedWidget } from "@/app/components/dashboard/contents-approved-widget"
import { RequirementsCompletedWidget } from "@/app/components/dashboard/requirements-completed-widget"
import { LeadsContactedWidget } from "@/app/components/dashboard/leads-contacted-widget"
import { LeadsInConversationWidget } from "@/app/components/dashboard/leads-in-conversation-widget"
import { MeetingsWidget } from "@/app/components/dashboard/meetings-widget"
import { SalesKpiWidget } from "@/app/components/dashboard/sales-kpi-widget"
import { InputTokensWidget } from "@/app/components/dashboard/input-tokens-widget"
import { OutputTokensWidget } from "@/app/components/dashboard/output-tokens-widget"
import { VideoMinutesWidget } from "@/app/components/dashboard/video-minutes-widget"
import { ImagesGeneratedWidget } from "@/app/components/dashboard/images-generated-widget"
import { TokenUsageChart } from "@/app/components/dashboard/token-usage-chart"
import { PerformanceMetricsChart } from "@/app/components/dashboard/performance-metrics-chart"
import { LeadsTasksChart } from "@/app/components/dashboard/leads-tasks-chart"

export default function DashboardPage() {
  const { user } = useAuth()
  const { currentSite } = useSite()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const [segments, setSegments] = useState<Segment[]>([])
  const [selectedSegment, setSelectedSegment] = useState<string>("all")
  const [isLoadingSegments, setIsLoadingSegments] = useState(false)
  const { cancelAllRequests } = useRequestController()
  
  // Add navigation blocking and hook subscriptions
  const { shouldPreventRefresh } = usePageRefreshPrevention()
  const { leads, contents, requirements, tasks, loading: contextLoading, refreshLeads, refreshContents, refreshRequirements, refreshTasks } = useContextEntities()
  
  // Navigation blocking state
  const [isNavigating, setIsNavigating] = useState(false)
  const [navigationBlocked, setNavigationBlocked] = useState(false)
  
  // Initialize dates and range type with safe values (one month ago to today) - ENHANCED
  const today = new Date()
  const oneMonthAgo = subMonths(today, 1)
  
  // Initialize dates for dashboard date range
  const [selectedRangeType, setSelectedRangeType] = useState<string>("This month")
  const [dateRange, setDateRange] = useState<{ startDate: Date; endDate: Date }>({
    startDate: oneMonthAgo,
    endDate: today
  })
  
  
  const [formattedTotal, setFormattedTotal] = useState("")
  const { settings } = useProfile()
  const userSettings = (settings as Record<string, any>) || {}
  
  // Check onboarding completion from site settings instead of user profile
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)
  const [activeTab, setActiveTab] = useState("performance")
  
  // Check onboarding completion from site settings
  // Always verify against database to ensure accurate state
  useEffect(() => {
    const checkOnboardingCompletion = async () => {
      if (!currentSite?.id) return
      
      const cacheKey = `onboarding_completed_${currentSite.id}`
      
      // Query DB to get actual onboarding state (don't rely on cache alone)
      try {
        const supabase = createClient()
        const { data: siteSettings } = await supabase
          .from('settings')
          .select('onboarding')
          .eq('site_id', currentSite.id)
          .single()
        
        if (siteSettings?.onboarding) {
          const onboardingTasks = siteSettings.onboarding
          const allTaskIds = [
            "configure_channels", "install_tracking_script", "set_business_hours",
            "setup_branding", "setup_billing", "validate_geographic_restrictions",
            "fine_tune_segments", "create_campaign", "setup_content", "configure_agents",
            "complete_requirement", "publish_and_feedback", "personalize_customer_journey",
            "assign_attribution_link", "import_leads", "pay_first_campaign", "invite_team",
            "create_coordination_task"
          ]
          
          // Check if all tasks are completed
          const allCompleted = allTaskIds.every(taskId => onboardingTasks[taskId] === true)
          setOnboardingCompleted(allCompleted)
          
          // Update cache based on actual state
          if (allCompleted) {
            localStorage.setItem(cacheKey, 'true')
          } else {
            // Clear cache if onboarding is not completed
            localStorage.removeItem(cacheKey)
          }
        } else {
          // No onboarding data found, assume not completed
          setOnboardingCompleted(false)
          localStorage.removeItem(cacheKey)
        }
      } catch (error) {
        console.error('Error checking onboarding completion:', error)
        // On error, don't assume completion - clear cache to force re-check
        localStorage.removeItem(cacheKey)
        setOnboardingCompleted(false)
      }
    }
    
    checkOnboardingCompletion()
  }, [currentSite?.id])

  // Re-check onboarding completion when user returns to browser tab
  // This ensures stale cache doesn't hide incomplete onboarding
  useEffect(() => {
    if (!currentSite?.id) return

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Re-verify onboarding completion from database when tab becomes visible
        const cacheKey = `onboarding_completed_${currentSite.id}`
        
        try {
          const supabase = createClient()
          const { data: siteSettings } = await supabase
            .from('settings')
            .select('onboarding')
            .eq('site_id', currentSite.id)
            .single()
          
          if (siteSettings?.onboarding) {
            const onboardingTasks = siteSettings.onboarding
            const allTaskIds = [
              "configure_channels", "install_tracking_script", "set_business_hours",
              "setup_branding", "setup_billing", "validate_geographic_restrictions",
              "fine_tune_segments", "create_campaign", "setup_content", "configure_agents",
              "complete_requirement", "publish_and_feedback", "personalize_customer_journey",
              "assign_attribution_link", "import_leads", "pay_first_campaign", "invite_team",
              "create_coordination_task"
            ]
            
            const allCompleted = allTaskIds.every(taskId => onboardingTasks[taskId] === true)
            setOnboardingCompleted(allCompleted)
            
            // Update cache based on actual state
            if (allCompleted) {
              localStorage.setItem(cacheKey, 'true')
            } else {
              localStorage.removeItem(cacheKey)
            }
          } else {
            setOnboardingCompleted(false)
            localStorage.removeItem(cacheKey)
          }
        } catch (error) {
          console.error('Error re-checking onboarding completion on visibility change:', error)
          // Don't assume completion on error
          localStorage.removeItem(cacheKey)
          setOnboardingCompleted(false)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [currentSite?.id])
  
  // Update URL when tab changes and get tab from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const urlTab = params.get('tab')
      const validTabs = ['performance', 'overview', 'analytics', 'traffic', 'costs', 'sales']
      
      // Only include onboarding in valid tabs if not completed
      if (!onboardingCompleted) {
        validTabs.unshift('onboarding')
      }
      
      if (urlTab && validTabs.includes(urlTab)) {
        setActiveTab(urlTab)
      } else {
        // Always default to performance tab
        setActiveTab("performance")
        
        // Update URL to match
        const url = new URL(window.location.href)
        url.searchParams.delete('tab')
        window.history.replaceState({}, '', url.toString())
      }
    }
  }, [onboardingCompleted])
  const [isInitialized, setIsInitialized] = useState(false)

  // If onboarding gets completed, switch away from onboarding tab
  useEffect(() => {
    if (onboardingCompleted && activeTab === "onboarding") {
      setActiveTab("performance")
    }
  }, [onboardingCompleted, activeTab])

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
    console.log(`[Dashboard] Current year: ${currentYear}, today: ${format(now, 'yyyy-MM-dd')}`);
    
    try {
      // Use today's date as the baseline, not the current year
      let safeStartDate = subMonths(now, 1); // Default to one month ago
      let safeEndDate = now; // Default to today
      
      // Ensure we have valid Date objects
      if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
        console.error("[Dashboard] Invalid start date:", startDate);
        // Use defaults already set above
      } else {
        // Check if the provided date is reasonable (not in future, not more than 2 years in past)
        const twoYearsAgo = subMonths(now, 24);
        
        // Use actual date comparison instead of year comparison
        if (startDate <= now && startDate >= twoYearsAgo) {
          safeStartDate = startDate;
        } else if (startDate > now) {
          console.warn(`[Dashboard] Start date is in the future: ${format(startDate, 'yyyy-MM-dd')}, using one month ago`);
          // Keep the default
        } else {
          console.warn(`[Dashboard] Start date is too old: ${format(startDate, 'yyyy-MM-dd')}, using one month ago`);
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
  }, [cancelAllRequests, determineRangeType, validateDates]);

  // Safety effect to detect and fix future dates that might slip through
  useEffect(() => {
    // Run this check only when dates are initialized and after any change
    if (isInitialized && dateRange.startDate && dateRange.endDate) {
      const now = new Date();
      let needsReset = false;
      
      // Check if either date is actually in the future (beyond today)
      if (dateRange.startDate > now || dateRange.endDate > now) {
        console.error(`[Dashboard] Future dates detected in initialized state: ${format(dateRange.startDate, 'yyyy-MM-dd')} - ${format(dateRange.endDate, 'yyyy-MM-dd')}`);
        console.error(`[Dashboard] Current date: ${format(now, 'yyyy-MM-dd')}`);
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
  }, [isInitialized, cancelAllRequests, determineRangeType]);

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
  }, [isInitialized]);

  // Handle site changes with proper state reset and data reloading
  useEffect(() => {
    if (currentSite?.id) {
      console.log('🔄 Dashboard: Site changed, resetting state and reloading data for site:', currentSite.id)
      
      // Cancel all in-flight requests when site changes
      cancelAllRequests()
      
      // Reset dashboard state
      setSelectedSegment("all")
      setFormattedTotal("")
      setIsNavigating(false)
      setNavigationBlocked(false)
      
      // Force reload of all context data
      refreshLeads()
      refreshContents()
      refreshRequirements()
      refreshTasks()
    }
  }, [currentSite?.id, cancelAllRequests, refreshLeads, refreshContents, refreshRequirements, refreshTasks])

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

  // Navigation blocking logic
  useEffect(() => {
    if (shouldPreventRefresh) {
      setNavigationBlocked(true)
      console.log('🚫 Dashboard: Navigation blocked due to refresh prevention')
    } else {
      setNavigationBlocked(false)
    }
  }, [shouldPreventRefresh])

  // Reset states when tab changes
  const handleTabChange = (newTab: string) => {
    if (newTab !== activeTab) {
      // Check if navigation is blocked
      if (navigationBlocked) {
        console.log('🚫 Dashboard: Tab change blocked due to navigation prevention')
        return
      }
      
      console.log(`[Dashboard] Changing tab from ${activeTab} to ${newTab}, cancelling all requests`);
      cancelAllRequests();
      setActiveTab(newTab);
      setFormattedTotal(""); // Reset formatted total when changing tabs
      
      // Update URL
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        if (newTab === 'performance') {
          url.searchParams.delete('tab')
        } else {
          url.searchParams.set('tab', newTab)
        }
        window.history.pushState({}, '', url.toString())
        
        // Emit custom event to notify TopBarActions
        window.dispatchEvent(new CustomEvent('dashboard:tabchange', {
          detail: { activeTab: newTab }
        }))
      }
    }
  }

  return (
    <div className="flex-1 p-0">
      {/* Navigation blocking indicator */}
      {navigationBlocked && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Navigation is temporarily blocked to protect your work. Please wait for the current operation to complete.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <Tabs 
        className="space-y-4"
        value={activeTab}
        onValueChange={handleTabChange}
      >
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <TabsList>
                  {!onboardingCompleted && (
                    <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
                  )}
                  <TabsTrigger value="performance">Performance</TabsTrigger>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  <TabsTrigger value="traffic">Traffic</TabsTrigger>
                  <TabsTrigger value="costs">Cost Reports</TabsTrigger>
                  <TabsTrigger value="sales">Sales Reports</TabsTrigger>
                </TabsList>
              </div>
              {activeTab !== "onboarding" && (
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
                  <div className="flex items-center">
                    <CalendarDateRangePicker 
                      onRangeChange={handleDateRangeChange} 
                      initialStartDate={dateRange.startDate}
                      initialEndDate={dateRange.endDate}
                      key={`date-range-${format(dateRange.startDate, 'yyyy-MM-dd')}-${format(dateRange.endDate, 'yyyy-MM-dd')}`}
                      className="flex items-center"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </StickyHeader>

        <div className="px-16 pt-3 pb-4">
          <div className="flex items-center justify-between space-x-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Hi, {userName}! 👋</h2>
              <p className="text-muted-foreground">
                {activeTab === "onboarding" 
                  ? "Let's get your growth engine set up and ready to capture leads!"
                  : `Welcome to your control panel - Viewing ${selectedRangeType} data (${format(dateRange.startDate, "MMMM d")} to ${format(dateRange.endDate, "MMMM d")} ${format(dateRange.endDate, "yyyy")})`
                }
              </p>
            </div>
          </div>
        </div>

        <div className="px-16">
          <TabsContent value="onboarding" className="space-y-4">
            {activeTab === "onboarding" && (
              <OnboardingItinerary />
            )}
          </TabsContent>
          <TabsContent value="performance" className="space-y-4">
            {activeTab === "performance" && (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 min-h-[160px]">
                  <LeadsContactedWidget 
                    segmentId={selectedSegment}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                  />
                  <LeadsInConversationWidget
                    segmentId={selectedSegment}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                  />
                  <MeetingsWidget
                    segmentId={selectedSegment}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                  />
                  <SalesKpiWidget
                    segmentId={selectedSegment}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                  />
                  <TasksWidget 
                    segmentId={selectedSegment}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                  />
                  <ConversationsWidget
                    segmentId={selectedSegment}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                  />
                  <ContentsApprovedWidget
                    segmentId={selectedSegment}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                  />
                  <RequirementsCompletedWidget
                    segmentId={selectedSegment}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                  />
                </div>
                <div className="grid gap-4 grid-cols-1">
                  <Card>
                    <CardHeader>
                      <CardTitle>Performance Metrics</CardTitle>
                      <CardDescription>Conversations, engagement, meetings, and sales over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PerformanceMetricsChart 
                        segmentId={selectedSegment}
                        startDate={dateRange.startDate}
                        endDate={dateRange.endDate}
                      />
                    </CardContent>
                  </Card>
                </div>
                <div className="grid gap-4 grid-cols-1">
                  <Card>
                    <CardHeader>
                      <CardTitle>Customer Success Metrics</CardTitle>
                      <CardDescription>Daily created leads and tasks over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <LeadsTasksChart
                        segmentId={selectedSegment}
                        startDate={dateRange.startDate}
                        endDate={dateRange.endDate}
                      />
                    </CardContent>
                  </Card>
                </div>
                <div className="grid gap-4 grid-cols-1">
                  <Card>
                    <CardHeader>
                      <CardTitle>Token Usage</CardTitle>
                      <CardDescription>Input vs Output token consumption over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <TokenUsageChart 
                        segmentId={selectedSegment}
                        startDate={dateRange.startDate}
                        endDate={dateRange.endDate}
                      />
                    </CardContent>
                  </Card>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 min-h-[160px]">
                  <InputTokensWidget
                    segmentId={selectedSegment}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                  />
                  <OutputTokensWidget
                    segmentId={selectedSegment}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                  />
                  <VideoMinutesWidget
                    segmentId={selectedSegment}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                  />
                  <ImagesGeneratedWidget
                    segmentId={selectedSegment}
                    startDate={dateRange.startDate}
                    endDate={dateRange.endDate}
                  />
                </div>
              </>
            )}
          </TabsContent>
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
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-2 h-[500px]">
                  <Card className="col-span-1 flex flex-col">
                    <CardHeader className="flex-shrink-0">
                      <CardTitle>Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2 flex-1 flex flex-col">
                      <div className="flex-1">
                        <Overview 
                          startDate={dateRange.startDate}
                          endDate={dateRange.endDate}
                          segmentId={selectedSegment}
                        />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="col-span-1 flex flex-col">
                    <CardHeader className="flex-shrink-0">
                      <CardTitle>Recent commercial activity</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <div className="flex-1">
                        <RecentActivity 
                          limit={6}
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
                      <CardTitle>Client Cohort Analysis</CardTitle>
                      <CardDescription>
                        Week-to-week retention metrics for users with at least 1 paid invoice (standardized).
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