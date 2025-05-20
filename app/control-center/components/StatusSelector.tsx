"use client"

import { Badge } from "@/app/components/ui/badge"
import { cn } from "@/lib/utils"

// Define task statuses
const TASK_STATUSES = [
  { id: "pending", name: "Pending" },
  { id: "in_progress", name: "In Progress" },
  { id: "completed", name: "Completed" },
  { id: "failed", name: "Failed" },
  { id: "canceled", name: "Canceled" }
] as const

type TaskStatus = typeof TASK_STATUSES[number]['id']

// Status styles
const STATUS_STYLES: Record<TaskStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  in_progress: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  completed: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  failed: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  canceled: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20"
}

interface StatusSelectorProps {
  currentStatus: TaskStatus
  onStatusChange: (status: TaskStatus) => void
}

export function StatusSelector({ currentStatus, onStatusChange }: StatusSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground whitespace-nowrap">Status:</span>
      <div className="flex space-x-2">
        {TASK_STATUSES.map((status) => (
          <Badge 
            key={status.id} 
            className={cn(
              "px-3 py-1 text-sm cursor-pointer transition-colors duration-200",
              currentStatus === status.id 
                ? STATUS_STYLES[status.id] 
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border border border-transparent"
            )}
            onClick={() => onStatusChange(status.id)}
          >
            {status.name}
          </Badge>
        ))}
      </div>
    </div>
  )
} 