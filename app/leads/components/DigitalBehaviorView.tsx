"use client"

import React, { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { Card } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Pagination } from "@/app/components/ui/pagination"
import { format } from "date-fns"
import {
  DocumentListHead,
  DocumentListRow,
  StatusDot,
} from "@/app/components/documents/document-list"

interface SessionEvent {
  id: string
  event_type: string
  event_name?: string
  url?: string
  timestamp: number
  created_at: string
  data?: any
  properties?: any
  referrer?: string
  user_agent?: string
}

interface DigitalBehaviorData {
  data: SessionEvent[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  summary: Record<string, number>
  totalSessions?: number
  topDevice?: string
  topLanguage?: string
  topRegion?: string
}

interface DigitalBehaviorViewProps {
  leadId: string
}

const EVENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  pageview: <span className="text-base">👁️</span>,
  click: <span className="text-base">👆</span>,
  form_submission: <span className="text-base">📝</span>,
  scroll: <span className="text-base">📜</span>,
  engagement: <span className="text-base">💬</span>,
  session_recording: <span className="text-base">🎥</span>,
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  pageview: "Page View",
  click: "Click",
  form_submission: "Form Submission",
  scroll: "Scroll",
  engagement: "Engagement",
  session_recording: "Session Recording",
}

export function DigitalBehaviorView({ leadId }: DigitalBehaviorViewProps) {
  const { currentSite } = useSite()
  const [data, setData] = useState<DigitalBehaviorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedEventType, setSelectedEventType] = useState<string>("all")
  const [pageSize, setPageSize] = useState(20)

  useEffect(() => {
    if (currentSite?.id && leadId) {
      fetchSessionEvents()
    }
  }, [currentSite?.id, leadId, currentPage, selectedEventType, pageSize])

  const fetchSessionEvents = async () => {
    if (!currentSite?.id) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        siteId: currentSite.id,
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      })

      if (selectedEventType !== "all") {
        params.append("eventType", selectedEventType)
      }

      const response = await fetch(`/api/leads/${leadId}/session-events?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch session events")
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error fetching session events:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleEventTypeChange = (value: string) => {
    setSelectedEventType(value)
    setCurrentPage(1) // Reset to first page when filter changes
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const formatEventData = (event: SessionEvent) => {
    const baseInfo = []
    
    if (event.url) {
      baseInfo.push(`URL: ${event.url}`)
    }
    
    if (event.event_name) {
      baseInfo.push(`Event: ${event.event_name}`)
    }

    if (event.data) {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data.page_title) {
          baseInfo.push(`Page: ${data.page_title}`)
        }
        if (data.element_text) {
          baseInfo.push(`Element: ${data.element_text}`)
        }
        if (data.scroll_depth) {
          baseInfo.push(`Scroll: ${data.scroll_depth}%`)
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
    }

    return baseInfo.join(" • ")
  }



  if (loading && !data) {
    return (
      <div className="space-y-6">
        {/* Summary Card Skeleton */}
        <Card className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="flex items-center space-x-2">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-12 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>

        {/* Events Table Skeleton */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-8 w-44" />
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <DocumentListHead>Type</DocumentListHead>
                  <DocumentListHead>Details</DocumentListHead>
                  <DocumentListHead align="right">Date</DocumentListHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Skeleton className="h-4 w-64" />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Skeleton className="ml-auto h-4 w-24" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <EmptyCard
        icon={<span className="text-4xl">📊</span>}
        title="Error Loading Digital Behavior"
        description={error}
      />
    )
  }

  if (!data || data.data.length === 0) {
    return (
      <EmptyCard
        icon={<span className="text-4xl">📊</span>}
        title="No Digital Behavior Data"
        description="This lead hasn't been tracked yet or has no recorded session events."
      />
    )
  }

  const eventTypes = Object.keys(data.summary).sort()

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      {Object.keys(data.summary).length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Digital Behavior Summary</h3>
          
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Session Metrics */}
                {data.totalSessions !== undefined && (
                  <TableRow>
                    <TableCell className="flex items-center space-x-2">
                      <span className="text-base">👥</span>
                      <span>Total Sessions</span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {data.totalSessions}
                    </TableCell>
                  </TableRow>
                )}
                {data.topDevice !== undefined && (
                  <TableRow>
                    <TableCell className="flex items-center space-x-2">
                      <span className="text-base">📱</span>
                      <span>Top Device</span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {data.topDevice}
                    </TableCell>
                  </TableRow>
                )}
                {data.topLanguage !== undefined && (
                  <TableRow>
                    <TableCell className="flex items-center space-x-2">
                      <span className="text-base">🌐</span>
                      <span>Top Language</span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {data.topLanguage}
                    </TableCell>
                  </TableRow>
                )}
                {data.topRegion !== undefined && (
                  <TableRow>
                    <TableCell className="flex items-center space-x-2">
                      <span className="text-base">🌍</span>
                      <span>Top Region</span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {data.topRegion}
                    </TableCell>
                  </TableRow>
                )}
                
                {/* Event Types */}
                {eventTypes.map((eventType) => (
                  <TableRow key={eventType}>
                    <TableCell className="flex items-center space-x-2">
                      {EVENT_TYPE_ICONS[eventType] || <span className="text-base">📊</span>}
                      <span>{EVENT_TYPE_LABELS[eventType] || eventType}</span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {data.summary[eventType]}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Events Table Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Session Events</h3>
          <Select value={selectedEventType} onValueChange={handleEventTypeChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {eventTypes.map((eventType) => (
                <SelectItem key={eventType} value={eventType}>
                  {EVENT_TYPE_LABELS[eventType] || eventType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <DocumentListHead className="w-[28%]">Type</DocumentListHead>
              <DocumentListHead className="w-[48%]">Details</DocumentListHead>
              <DocumentListHead className="w-[24%]" align="right">Date</DocumentListHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((event) => (
              <DocumentListRow key={event.id} accent="none" className="cursor-default">
                <TableCell className="py-3.5">
                  <div className="flex items-center gap-2">
                    {EVENT_TYPE_ICONS[event.event_type] || <span className="text-base">📊</span>}
                    <StatusDot
                      status={event.event_type}
                      label={EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                    />
                  </div>
                </TableCell>
                <TableCell className="py-3.5 max-w-md">
                  <p className="text-sm text-muted-foreground truncate">
                    {formatEventData(event) || "No additional data"}
                  </p>
                </TableCell>
                <TableCell className="py-3.5 text-right">
                  <div className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(event.created_at), "MMM d, yyyy")}
                  </div>
                  <div className="text-[11px] text-muted-foreground/80">
                    {format(new Date(event.created_at), "h:mm a")}
                  </div>
                </TableCell>
              </DocumentListRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        {data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20 mt-4">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium">{((data.pagination.page - 1) * data.pagination.pageSize) + 1}</span> to{" "}
                <span className="font-medium">
                  {Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total)}
                </span>{" "}
                of <span className="font-medium">{data.pagination.total}</span> events
              </p>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => {
                  setPageSize(parseInt(value))
                  setCurrentPage(1) // Reset to first page when page size changes
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pageSize.toString()} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 50, 100].map((value) => (
                    <SelectItem key={value} value={value.toString()}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Pagination
              currentPage={data.pagination.page}
              totalPages={data.pagination.totalPages}
              onPageChange={handlePageChange}
              disabled={loading}
            />
          </div>
        )}
      </Card>
    </div>
  )
} 