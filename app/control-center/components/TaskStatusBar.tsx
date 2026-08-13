"use client"

import { ProgressiveStatusBar } from "@/app/components/ui/progressive-status-bar"

type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "canceled"

const FORWARD_PATH: TaskStatus[] = ["pending", "in_progress", "completed"]
const OUTCOMES: TaskStatus[] = ["failed", "canceled"]

const STATUS_STYLES: Record<TaskStatus, string> = {
  pending: "bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
  in_progress: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
  completed: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  failed: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200",
  canceled: "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200",
}

const STATUS_NAMES: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled",
}

interface TaskStatusBarProps {
  currentStatus: TaskStatus
  onStatusChange: (status: TaskStatus) => void
}

export function TaskStatusBar({ currentStatus, onStatusChange }: TaskStatusBarProps) {
  return (
    <ProgressiveStatusBar
      current={currentStatus}
      forwardPath={FORWARD_PATH}
      outcomes={OUTCOMES}
      styles={STATUS_STYLES}
      labels={STATUS_NAMES}
      onChange={onStatusChange}
    />
  )
}
