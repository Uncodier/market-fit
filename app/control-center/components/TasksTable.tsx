"use client"

import React from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Card } from "@/app/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { ChevronLeft, ChevronRight } from "@/app/components/ui/icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"

interface Task {
  id: string
  title: string
  description: string | null
  status: 'completed' | 'in_progress' | 'pending' | 'failed' | 'canceled'
  stage?: 'awareness' | 'consideration' | 'decision' | 'purchase' | 'retention' | 'referral'
  scheduled_date: string
  lead_id?: string
  assignee_id?: string
  leadName?: string
  assigneeName?: string
}

interface TasksTableProps {
  tasks: Task[]
  currentPage: number
  itemsPerPage: number
  totalTasks: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (value: string) => void
  onTaskClick: (task: Task) => void
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

// Stage styles
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
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage
  const totalPages = Math.ceil(totalTasks / itemsPerPage)

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Title</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Lead</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <TableRow 
                key={task.id}
                className="group hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => onTaskClick(task)}
              >
                <TableCell>
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.description}</p>
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
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback>
                          {task.leadName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{task.leadName}</span>
                    </div>
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
                <TableCell>
                  <Badge className={`${STATUS_STYLES[task.status]}`}>
                    {task.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        // Add task-specific actions here
                      }}
                    >
                      {/* Add task-specific action icons here */}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center">
                No tasks found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between px-6 py-4 border-t">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{Math.min(indexOfFirstItem + 1, totalTasks)}</span> to <span className="font-medium">{Math.min(indexOfFirstItem + itemsPerPage, totalTasks)}</span> of <span className="font-medium">{totalTasks}</span> tasks
          </p>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={onItemsPerPageChange}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={itemsPerPage.toString()} />
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
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
} 