"use client"

import React, { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Card } from "@/app/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { ChevronLeft, ChevronRight, MessageSquare, Clock, PlayCircle, CheckCircle2, XCircle, Ban } from "@/app/components/ui/icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Task } from "@/app/types"

interface ExtendedTask extends Task {
  leadName?: string
  assigneeName?: string
  comments_count?: number
}

interface TasksTableProps {
  tasks: ExtendedTask[]
  currentPage: number
  itemsPerPage: number
  totalTasks: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (value: string) => void
  onTaskClick: (task: ExtendedTask) => void
  categories: Array<{ id: string; name: string }>
}

// Status styles
const STATUS_STYLES = {
  pending: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
  in_progress: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
  completed: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  failed: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
  canceled: "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200"
}

// Define task statuses with colors and icons for the table
const TASK_STATUSES = [
  { 
    id: "pending", 
    name: "Pending", 
    icon: Clock,
    color: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/30"
  },
  { 
    id: "in_progress", 
    name: "In Progress", 
    icon: PlayCircle,
    color: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
    bgColor: "bg-blue-50 dark:bg-blue-950/30"
  },
  { 
    id: "completed", 
    name: "Completed", 
    icon: CheckCircle2,
    color: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
    bgColor: "bg-green-50 dark:bg-green-950/30"
  },
  { 
    id: "failed", 
    name: "Failed", 
    icon: XCircle,
    color: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
    bgColor: "bg-red-50 dark:bg-red-950/30"
  },
  { 
    id: "canceled", 
    name: "Canceled", 
    icon: Ban,
    color: "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200",
    bgColor: "bg-orange-50 dark:bg-orange-950/30"
  }
]

// Stage styles (keep for backward compatibility)
const STAGE_STYLES = {
  awareness: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
  consideration: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
  decision: "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200",
  purchase: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  retention: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200",
  referral: "bg-pink-50 text-pink-700 hover:bg-pink-100 border-pink-200"
}

// Format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Get stage display name
const getStageDisplayName = (stage?: string) => {
  if (!stage) return "-"
  return stage.charAt(0).toUpperCase() + stage.slice(1)
}

// Extract numeric part from serial_id
const getSerialNumber = (serialId: string) => {
  if (!serialId) return ""
  // Extract prefix and number parts
  const match = serialId.match(/^([A-Z]+)-(\d+)$/)
  if (match) {
    const prefix = match[1]
    const number = parseInt(match[2], 10).toString()
    return `${prefix}-${number}`
  }
  return serialId
}

export function TasksTable({ 
  tasks,
  currentPage,
  itemsPerPage,
  totalTasks,
  onPageChange,
  onItemsPerPageChange,
  onTaskClick,
  categories
}: TasksTableProps) {
  // State for individual pagination per status
  const [statusPages, setStatusPages] = useState<Record<string, number>>(() => {
    const initialPages: Record<string, number> = {}
    TASK_STATUSES.forEach(status => {
      initialPages[status.id] = 1
    })
    return initialPages
  })
  
  const [statusItemsPerPage, setStatusItemsPerPage] = useState(5) // Smaller per-section pagination
  
  // Group tasks by status
  const groupedTasks = useMemo(() => {
    const groups: Record<string, ExtendedTask[]> = {}
    
    // Initialize all statuses with empty arrays
    TASK_STATUSES.forEach(status => {
      groups[status.id] = []
    })
    
    // Group tasks by status
    tasks.forEach(task => {
      if (task.status && groups[task.status]) {
        groups[task.status].push(task)
      } else {
        // Tasks without valid status go to pending by default
        groups['pending'].push(task)
      }
    })
    
    return groups
  }, [tasks])
  
  // Helper functions for pagination per status
  const getPaginatedStatusItems = (statusId: string, statusItems: ExtendedTask[]) => {
    const currentPage = statusPages[statusId] || 1
    const startIndex = (currentPage - 1) * statusItemsPerPage
    const endIndex = startIndex + statusItemsPerPage
    return statusItems.slice(startIndex, endIndex)
  }
  
  const getStatusTotalPages = (statusItems: ExtendedTask[]) => {
    return Math.ceil(statusItems.length / statusItemsPerPage)
  }
  
  const handleStatusPageChange = (statusId: string, newPage: number) => {
    setStatusPages(prev => ({
      ...prev,
      [statusId]: newPage
    }))
  }

  return (
    <div className="space-y-6">
      {TASK_STATUSES.map(status => {
        const statusItems = groupedTasks[status.id] || []
        
        if (statusItems.length === 0) return null
        
        const paginatedItems = getPaginatedStatusItems(status.id, statusItems)
        const totalPages = getStatusTotalPages(statusItems)
        const currentPage = statusPages[status.id] || 1
        const startIndex = (currentPage - 1) * statusItemsPerPage
        const Icon = status.icon
        
        return (
          <div key={status.id} className="space-y-3">
            {/* Status Header */}
            <div className="flex items-center gap-3 px-1">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold text-foreground">{status.name}</h3>
              </div>
              <Badge variant="outline" className="text-sm">
                {statusItems.length} {statusItems.length === 1 ? 'task' : 'tasks'}
              </Badge>
            </div>
            
            {/* Status Table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px] min-w-[80px] max-w-[80px]">ID</TableHead>
                    <TableHead className="min-w-[200px]">Title</TableHead>
                    <TableHead className="w-[120px] min-w-[120px] max-w-[120px]">Stage</TableHead>
                    <TableHead className="w-[130px] min-w-[130px] max-w-[130px]">Lead</TableHead>
                    <TableHead className="w-[140px] min-w-[140px] max-w-[140px]">Assignee</TableHead>
                    <TableHead className="w-[140px] min-w-[140px] max-w-[140px]">Due Date</TableHead>
                    <TableHead className="w-[100px] min-w-[100px] max-w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.length > 0 ? (
                    paginatedItems.map((task) => (
                      <TableRow 
                        key={task.id}
                        className="group hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => onTaskClick(task)}
                      >
                        <TableCell>
                          <div className="font-mono text-xs text-muted-foreground">
                            {getSerialNumber(task.serial_id)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-medium text-sm line-clamp-2" title={task.title}>{task.title}</p>
                            <p className="text-xs text-muted-foreground min-h-[1.2rem] line-clamp-2" title={task.description || ""}>{task.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {task.stage ? (
                            <Badge className={STAGE_STYLES[task.stage]}>
                              {getStageDisplayName(task.stage)}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {task.leadName ? (
                            <span className="text-sm">{task.leadName}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {task.assigneeName ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback>
                                  {task.assigneeName.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{task.assigneeName}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatDate(task.scheduled_date)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {task.comments_count ? (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MessageSquare className="h-3.5 w-3.5" />
                                <span>{task.comments_count}</span>
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        No tasks found for this status.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              
              {/* Status Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                      Showing <span className="font-medium">{Math.min(startIndex + 1, statusItems.length)}</span> to <span className="font-medium">{Math.min(startIndex + statusItemsPerPage, statusItems.length)}</span> of <span className="font-medium">{statusItems.length}</span> tasks
                    </p>
                    <Select
                      value={statusItemsPerPage.toString()}
                      onValueChange={(value) => setStatusItemsPerPage(parseInt(value))}
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder={statusItemsPerPage.toString()} />
                      </SelectTrigger>
                      <SelectContent side="top">
                        {[5, 10, 20, 50].map((value) => (
                          <SelectItem key={value} value={value.toString()}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleStatusPageChange(status.id, currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleStatusPageChange(status.id, currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )
      })}
      
      {/* Show message if no tasks at all */}
      {tasks.length === 0 && (
        <Card>
          <div className="h-24 flex items-center justify-center text-center">
            <p className="text-muted-foreground">No tasks found.</p>
          </div>
        </Card>
      )}
    </div>
  )
} 