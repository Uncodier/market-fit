"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { Card } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyState } from "@/app/components/ui/empty-state"
import { Clock, AlertCircle, CheckCircle2, PlayCircle, RotateCw, XCircle, ChevronDown, ChevronRight } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { Pagination } from "@/app/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"

interface CronStatus {
  id: string
  workflow_id: string | null
  schedule_id: string | null
  activity_name: string | null
  status: string
  last_run: string | null
  next_run: string | null
  error_message: string | null
  retry_count: number
  site_id: string
  created_at: string
  updated_at: string
}

interface ActivityGroup {
  schedule_id: string | null
  activities: CronStatus[]
  isExpanded: boolean
  totalCount: number
  latestActivity: CronStatus
  overallStatus: string
}

interface ActivitiesViewProps {
  searchQuery?: string
}

export function ActivitiesView({ searchQuery = "" }: ActivitiesViewProps) {
  const [activities, setActivities] = useState<CronStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(500) // Start with 500 as requested
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const { currentSite } = useSite()

  // Load activities from cron_status table via API endpoint
  const loadActivities = async (page: number = currentPage, limit: number = itemsPerPage) => {
    if (!currentSite?.id) {
      console.log("❌ No site ID available")
      return
    }

    try {
      setError(null)
      
      console.log("🔍 Fetching activities for site:", currentSite.id, "page:", page, "limit:", limit)
      
      // Call our API endpoint with admin permissions and pagination
      console.log("🌐 Calling cron-status API endpoint...")
      const response = await fetch(`/api/cron-status?siteId=${currentSite.id}&page=${page}&limit=${limit}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error("❌ API endpoint error:", errorData)
        setError(`API error: ${errorData.error || 'Unknown error'}`)
        toast.error("Failed to load activities from server")
        return
      }

      const result = await response.json()
      
      console.log("🧪 API response:", { 
        success: result.success,
        count: result.data?.length || 0,
        pagination: result.pagination,
        meta: result.meta
      })
      
      if (!result.success) {
        console.error("❌ API returned error:", result.error)
        setError(`Server error: ${result.error}`)
        toast.error("Server error loading activities")
        return
      }
      
      const data = result.data || []
      console.log("✅ Setting activities:", data.length, "records")
      setActivities(data)
      
      // Update pagination state
      if (result.pagination) {
        setCurrentPage(result.pagination.currentPage)
        setTotalPages(result.pagination.totalPages)
        setTotalCount(result.pagination.totalCount)
      }
      
      if (data.length === 0) {
          console.log("⚠️  No records found for site_id:", currentSite.id)
        console.log("💡 Available site_ids:", result.meta?.availableSiteIds || [])
      }
    } catch (err) {
      console.error("💥 Unexpected error loading activities:", err)
      setError("Failed to load activities")
      toast.error("Error loading activities")
    } finally {
      setLoading(false)
    }
  }

  // Load activities when component mounts or currentSite changes
  useEffect(() => {
    setCurrentPage(1) // Reset to first page when site changes
    loadActivities(1, itemsPerPage)
  }, [currentSite?.id])

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    loadActivities(page, itemsPerPage)
  }

  const handleItemsPerPageChange = (value: string) => {
    const newItemsPerPage = parseInt(value, 10)
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1) // Reset to first page
    loadActivities(1, newItemsPerPage)
  }

  // Group activities by schedule_id and filter by search query
  const activityGroups = useMemo(() => {
    if (!activities || !Array.isArray(activities)) return []

    // First, filter activities based on search query
    const filteredActivities = activities.filter(activity => {
      if (!searchQuery.trim()) return true
      
      const query = searchQuery.toLowerCase().trim()
      const matchesScheduleId = activity.schedule_id?.toLowerCase().includes(query)
      const matchesActivityName = activity.activity_name?.toLowerCase().includes(query)
      const matchesWorkflowId = activity.workflow_id?.toLowerCase().includes(query)
      const matchesStatus = activity.status?.toLowerCase().includes(query)
      const matchesErrorMessage = activity.error_message?.toLowerCase().includes(query)
      
      return matchesScheduleId || matchesActivityName || matchesWorkflowId || matchesStatus || matchesErrorMessage
    })

    const groupMap = new Map<string, CronStatus[]>()
    
    filteredActivities.forEach(activity => {
      const key = activity.schedule_id || 'no-schedule'
      if (!groupMap.has(key)) {
        groupMap.set(key, [])
      }
      groupMap.get(key)!.push(activity)
    })

    return Array.from(groupMap.entries()).map(([scheduleId, groupActivities]) => {
      // Sort activities by created_at desc to get latest first
      const sortedActivities = groupActivities.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      
      const latestActivity = sortedActivities[0]
      
      // Determine overall status - prioritize errors, then running, then completed
      let overallStatus = 'completed'
      if (groupActivities.some(a => a.status.toLowerCase() === 'failed' || a.status.toLowerCase() === 'error')) {
        overallStatus = 'failed'
      } else if (groupActivities.some(a => a.status.toLowerCase() === 'running' || a.status.toLowerCase() === 'active')) {
        overallStatus = 'running'  
      } else if (groupActivities.some(a => a.status.toLowerCase() === 'pending' || a.status.toLowerCase() === 'scheduled')) {
        overallStatus = 'pending'
      }

      return {
        schedule_id: scheduleId === 'no-schedule' ? null : scheduleId,
        activities: sortedActivities,
        isExpanded: expandedGroups[scheduleId] || false,
        totalCount: groupActivities.length,
        latestActivity,
        overallStatus
      }
    }).sort((a, b) => {
      // Sort groups by latest activity time
      return new Date(b.latestActivity.created_at).getTime() - new Date(a.latestActivity.created_at).getTime()
    })
  }, [activities, expandedGroups, searchQuery])

  const toggleGroupExpansion = (scheduleId: string | null) => {
    const key = scheduleId || 'no-schedule'
    setExpandedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "success":
        return <Badge className="bg-success/20 text-success border-success/20">Completed</Badge>
      case "running":
      case "active":
        return <Badge className="bg-info/20 text-info border-info/20">Running</Badge>
      case "pending":
      case "scheduled":
        return <Badge className="bg-secondary/20 text-secondary-foreground border-secondary/20">Pending</Badge>
      case "failed":
      case "error":
        return <Badge className="bg-destructive/20 text-destructive border-destructive/20">Failed</Badge>
      case "cancelled":
      case "stopped":
        return <Badge className="bg-muted text-muted-foreground border-muted/20">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-success" />
      case "running":
      case "active":
        return <RotateCw className="h-4 w-4 text-info" />
      case "pending":
      case "scheduled":
        return <Clock className="h-4 w-4 text-muted-foreground" />
      case "failed":
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />
      case "cancelled":
      case "stopped":
        return <XCircle className="h-4 w-4 text-muted-foreground" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "—"
    
    try {
      const date = new Date(dateString)
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date)
    } catch (error) {
      console.error("Invalid date format:", dateString)
      return "—"
    }
  }

  if (loading) {
  return (
      <div className="p-8 space-y-4">
        <div className="px-8">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Flow</TableHead>
                  <TableHead className="w-[140px] min-w-[140px] max-w-[140px]">Status</TableHead>
                  <TableHead className="w-[130px] min-w-[130px] max-w-[130px]">Last Run</TableHead>
                  <TableHead className="w-[130px] min-w-[130px] max-w-[130px]">Next Run</TableHead>
                  <TableHead className="w-[200px] min-w-[200px] max-w-[200px]">Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded" />
                        <div className="space-y-0.5 flex-1">
                          <Skeleton className="h-4 w-[180px]" />
                          <Skeleton className="h-3 w-[120px]" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-3 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-3 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-3 w-32" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 space-y-4">
        <div className="px-8">
          <Card>
            <div className="p-6">
              <EmptyState
                icon={<AlertCircle className="h-8 w-8" />}
                title="Error Loading Activities"
                description={error}
                action={
                  <button 
                    onClick={() => loadActivities()}
                    className="text-sm text-primary hover:underline"
                  >
                    Try again
                  </button>
                }
              />
            </div>
          </Card>
        </div>
      </div>
    )
  }

  if (!activityGroups.length) {
    const isSearching = searchQuery.trim().length > 0
    return (
      <div className="p-8 space-y-4">
        <div className="px-8">
          <Card>
            <div className="p-6">
              <EmptyState
                icon={<PlayCircle className="h-8 w-8" />}
                title={isSearching ? "No Activities Found" : "No Activities Found"}
                description={
                  isSearching 
                    ? `No activities found matching "${searchQuery}". Try adjusting your search terms.`
                    : "No scheduled activities found for this site."
                }
                action={
                  <button 
                    onClick={() => loadActivities()}
                    className="text-sm text-primary hover:underline"
                  >
                    Refresh
                  </button>
                }
              />
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-4">
      <div className="px-8">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Flow</TableHead>
                <TableHead className="w-[140px] min-w-[140px] max-w-[140px]">Status</TableHead>
                <TableHead className="w-[130px] min-w-[130px] max-w-[130px]">Last Run</TableHead>
                <TableHead className="w-[130px] min-w-[130px] max-w-[130px]">Next Run</TableHead>
                <TableHead className="w-[200px] min-w-[200px] max-w-[200px]">Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
          {activityGroups.map((group) => (
            <React.Fragment key={group.schedule_id || 'no-schedule'}>
              {/* Group header row */}
              <TableRow 
                className="group hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => toggleGroupExpansion(group.schedule_id)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0">
                      {group.totalCount > 1 ? (
                        group.isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )
                      ) : (
                        <div className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusIcon(group.overallStatus)}
                    </div>
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <p className="font-medium text-sm line-clamp-2" title={group.schedule_id || "No Schedule"}>
                        {group.schedule_id || "Individual Activities"}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2" title={group.latestActivity.activity_name || "No activity name"}>
                        {group.latestActivity.activity_name || "Unnamed Activity"}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {getStatusBadge(group.overallStatus)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(group.latestActivity.last_run)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(group.latestActivity.next_run)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {group.latestActivity.error_message ? (
                    <div className="text-destructive line-clamp-2" title={group.latestActivity.error_message}>
                      {group.latestActivity.error_message}
                    </div>
                  ) : "—"}
                </TableCell>
              </TableRow>

              {/* Expanded activities */}
              {group.isExpanded && group.totalCount > 1 && group.activities.map((activity) => (
                <TableRow
                  key={activity.id}
                  className="group hover:bg-muted/30 transition-colors border-l-4 border-l-blue-200 bg-muted/20"
                >
                  <TableCell className="pl-12">
                    <div className="flex items-center gap-2">
                      <div className="flex-shrink-0">
                        {getStatusIcon(activity.status)}
                      </div>
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <p className="font-medium text-sm line-clamp-2" title={activity.activity_name || "No activity name"}>
                          {activity.activity_name || "Unnamed Activity"}
                        </p>
                        {activity.workflow_id && (
                          <p className="text-xs text-muted-foreground line-clamp-1" title={`Workflow: ${activity.workflow_id}`}>
                            Workflow: {activity.workflow_id}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(activity.status)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(activity.last_run)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(activity.next_run)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {activity.error_message ? (
                      <div className="text-destructive line-clamp-2" title={activity.error_message}>
                        {activity.error_message}
                      </div>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </React.Fragment>
          ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="flex items-center gap-4">
                <p className="text-sm text-muted-foreground">
                  Showing <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, totalCount)}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalCount)}</span> of <span className="font-medium">{totalCount}</span> activities
                </p>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={handleItemsPerPageChange}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue placeholder={itemsPerPage.toString()} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[50, 100, 250, 500].map((value) => (
                      <SelectItem key={value} value={value.toString()}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}