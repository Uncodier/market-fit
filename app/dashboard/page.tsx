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

export default function DashboardPage() {
  const { user } = useAuth()
  const { currentSite } = useSite()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const [segments, setSegments] = useState<Segment[]>([])
  const [selectedSegment, setSelectedSegment] = useState<string>("all")
  const [isLoadingSegments, setIsLoadingSegments] = useState(false)

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
                      <SelectValue placeholder="All segments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All segments</SelectItem>
                      {segments.map((segment) => (
                        <SelectItem key={segment.id} value={segment.id}>
                          {segment.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <CalendarDateRangePicker />
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className="px-16 pt-6 pb-4">
          <div className="flex items-center justify-between space-x-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Hi, {userName}! 👋</h2>
              <p className="text-muted-foreground">
                Welcome to your control panel
              </p>
            </div>
          </div>
        </div>

        <div className="px-16">
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Revenue
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Total revenue across all segments
                    </TooltipContent>
                  </Tooltip>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$45,231.89</div>
                  <p className="text-xs text-muted-foreground">
                    <span className={20.1 > 0 ? "text-green-500" : "text-red-500"}>+20.1%</span> from last month
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Users
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Users active in the last 30 days
                    </TooltipContent>
                  </Tooltip>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">+2350</div>
                  <p className="text-xs text-muted-foreground">
                    <span className={180.1 > 0 ? "text-green-500" : "text-red-500"}>+180.1%</span> from last month
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Segments
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Number of active user segments
                    </TooltipContent>
                  </Tooltip>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground">
                    <span className={3 > 0 ? "text-green-500" : "text-red-500"}>+3</span> from last month
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Experiments
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Number of running experiments
                    </TooltipContent>
                  </Tooltip>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">4</div>
                  <p className="text-xs text-muted-foreground">
                    <span className={1 > 0 ? "text-green-500" : "text-red-500"}>+1</span> from last month
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    LTV (Life Time Value)
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Average value a customer generates during their lifecycle
                    </TooltipContent>
                  </Tooltip>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$2,420</div>
                  <p className="text-xs text-muted-foreground">
                    <span className={15.2 > 0 ? "text-green-500" : "text-red-500"}>+15.2%</span> from last month
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    CAC (Customer Acquisition Cost)
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Average cost of acquiring a new customer
                    </TooltipContent>
                  </Tooltip>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$380</div>
                  <p className="text-xs text-muted-foreground">
                    <span className={-8.4 > 0 ? "text-green-500" : "text-red-500"}>-8.4%</span> from last month
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    ROI (Return on Investment)
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Return on marketing investment
                    </TooltipContent>
                  </Tooltip>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">6.37x</div>
                  <p className="text-xs text-muted-foreground">
                    <span className={24.8 > 0 ? "text-green-500" : "text-red-500"}>+24.8%</span> from last month
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    CPC (Cost per Click)
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Average cost per ad click
                    </TooltipContent>
                  </Tooltip>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$1.25</div>
                  <p className="text-xs text-muted-foreground">
                    <span className={-12.3 > 0 ? "text-green-500" : "text-red-500"}>-12.3%</span> from last month
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-7">
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>Overview</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  <Overview />
                </CardContent>
              </Card>
              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>
                    You had 265 interactions this month.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RecentActivity />
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