"use client"

import React from "react"
import { Badge } from "@/app/components/ui/badge"

// Task status options
const TASK_STATUSES = [
  { id: 'pending', name: 'Pending' },
  { id: 'in_progress', name: 'In Progress' },
  { id: 'completed', name: 'Completed' },
  { id: 'failed', name: 'Failed' },
  { id: 'canceled', name: 'Canceled' }
]

// Status styles
const STATUS_STYLES = {
  pending: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
  in_progress: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
  completed: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  failed: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
  canceled: "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200"
}

interface TaskStatusBarProps {
  currentStatus: "pending" | "in_progress" | "completed" | "failed" | "canceled"
  onStatusChange: (status: "pending" | "in_progress" | "completed" | "failed" | "canceled") => void
}

export function TaskStatusBar({ currentStatus, onStatusChange }: TaskStatusBarProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex space-x-2">
        {TASK_STATUSES.map((status) => (
          <Badge 
            key={status.id} 
            className={`px-3 py-1 text-sm cursor-pointer transition-colors duration-200 ${
              currentStatus === status.id 
                ? STATUS_STYLES[status.id] 
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border border border-transparent'
            }`}
            onClick={() => onStatusChange(status.id as "pending" | "in_progress" | "completed" | "failed" | "canceled")}
          >
            {status.name}
          </Badge>
        ))}
      </div>
    </div>
  )
} 