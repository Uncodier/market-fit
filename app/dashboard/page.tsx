"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { RecentActivity } from "@/app/components/dashboard/recent-activity"
import { Overview } from "@/app/components/dashboard/overview"
import { SegmentMetrics } from "@/app/components/dashboard/segment-metrics"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { HelpCircle } from "@/app/components/ui/icons"

export default function DashboardPage() {
  const { isAuthenticated, isLoading, user } = useAuthContext()
  const router = useRouter()
  const [localLoading, setLocalLoading] = useState(true)

  // Authentication verification - Double security
  useEffect(() => {
    console.log("[Dashboard] Authentication state:", { isAuthenticated, isLoading, user })
    
    if (!isLoading && !isAuthenticated) {
      console.log("[Dashboard] User not authenticated, redirecting to login")
      router.push("/auth/login?returnTo=/dashboard")
    }
    
    const timer = setTimeout(() => {
      setLocalLoading(false)
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [isAuthenticated, isLoading, router, user])

  // Loading screen with visual feedback
  if (isLoading || localLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="h-12 w-12 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin mb-4" 
             role="status" 
             aria-label="Loading">
        </div>
        <p className="text-lg text-gray-700">Loading dashboard...</p>
        <p className="text-sm text-gray-500 mt-2">Please wait while we verify your session</p>
      </div>
    )
  }

  // Double verification: if somehow reaches here without authentication, show message
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md">
          <h2 className="text-2xl font-bold mb-4 text-center">Unauthorized Access</h2>
          <p className="mb-4 text-gray-600">
            You don't have permission to access this page. You will be redirected to the login page.
          </p>
          <div className="mt-4 flex justify-center">
            <button 
              onClick={() => router.push("/auth/login?returnTo=/dashboard")}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Main dashboard content
  return (
    <div className="flex-1 p-0">
      <TooltipProvider>
        <Tabs defaultValue="overview" className="w-full">
          <StickyHeader>
            <div className="px-16 pt-0">
              <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="segments">Segments</TabsTrigger>
                <TabsTrigger value="experiments">Experiments</TabsTrigger>
              </TabsList>
            </div>
          </StickyHeader>
          
          <div className="p-8 space-y-6">
            <div className="px-8">
              <TabsContent value="overview" className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    title="Total Segments"
                    value="12"
                    change="+2"
                    tooltip="Total number of customer segments created"
                  />
                  <MetricCard
                    title="Active Experiments"
                    value="8"
                    change="+3"
                    tooltip="Number of currently running A/B tests"
                  />
                  <MetricCard
                    title="Total Leads"
                    value="573"
                    change="+201"
                    tooltip="Total number of qualified leads generated"
                  />
                  <MetricCard
                    title="Conversion Rate"
                    value="24.3%"
                    change="+5.1%"
                    tooltip="Percentage of visitors who become leads"
                  />
                  <MetricCard
                    title="ROI"
                    value="342%"
                    change="+28%"
                    tooltip="Return on Investment from marketing campaigns"
                  />
                  <MetricCard
                    title="CAC"
                    value="$48.2"
                    change="-12%"
                    tooltip="Customer Acquisition Cost"
                  />
                  <MetricCard
                    title="CPC"
                    value="$2.4"
                    change="-0.8%"
                    tooltip="Cost Per Click on ads"
                  />
                  <MetricCard
                    title="LTV"
                    value="$850"
                    change="+15%"
                    tooltip="Customer Lifetime Value"
                  />
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                  <Card className="col-span-4 hover:bg-gray-50/50 transition-all">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg font-semibold text-gray-900 w-full flex items-center justify-between">
                        <span>Overview</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="hover:text-gray-900 transition-colors ml-2">
                              <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[200px] text-sm">
                            <p>Performance metrics over time</p>
                          </TooltipContent>
                        </Tooltip>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Overview />
                    </CardContent>
                  </Card>
                  <Card className="col-span-3 hover:bg-gray-50/50 transition-all">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg font-semibold text-gray-900 w-full flex items-center justify-between">
                        <span>Segment Metrics</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="hover:text-gray-900 transition-colors ml-2">
                              <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[200px] text-sm">
                            <p>Performance breakdown by customer segment</p>
                          </TooltipContent>
                        </Tooltip>
                      </CardTitle>
                      <CardDescription className="text-sm text-gray-500">
                        Performance by segment
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <SegmentMetrics />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              <TabsContent value="segments" className="space-y-6">
                <Card className="col-span-3 hover:bg-gray-50/50 transition-all">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold text-gray-900 w-full flex items-center justify-between">
                      <span>Top Performing Segments</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="hover:text-gray-900 transition-colors ml-2">
                            <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[200px] text-sm">
                          <p>Segments with the highest engagement rates</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-500">
                      Segments with highest engagement
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RecentActivity />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="experiments" className="space-y-6">
                <Card className="col-span-3 hover:bg-gray-50/50 transition-all">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold text-gray-900 w-full flex items-center justify-between">
                      <span>Recent Experiments</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="hover:text-gray-900 transition-colors ml-2">
                            <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[200px] text-sm">
                          <p>Latest A/B testing results and insights</p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-500">
                      Latest experiment results
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RecentActivity />
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </TooltipProvider>
    </div>
  )
}

// Reusable MetricCard component
function MetricCard({ title, value, change, tooltip }: { 
  title: string
  value: string
  change: string
  tooltip: string 
}) {
  const isPositive = change.startsWith('+')
  
  return (
    <Card className="overflow-hidden transition-all hover:bg-gray-50/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-gray-600 w-full flex items-center justify-between">
          <span>{title}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="hover:text-gray-900 transition-colors ml-2">
                <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[200px] text-sm">
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-bold tracking-tight text-gray-900">{value}</div>
        <p className={`text-xs mt-1.5 flex items-center gap-1 ${
          isPositive ? 'text-emerald-600' : 'text-red-600'
        }`}>
          {change} 
          <span className="text-gray-500 font-normal">from last month</span>
        </p>
      </CardContent>
    </Card>
  )
} 