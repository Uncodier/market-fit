"use client"

import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import {
  Check,
  Clock,
  AlertCircle,
  MessageSquare,
  Tag,
  Pencil,
  Trash2,
} from "@/app/components/ui/icons"
import { format } from "date-fns"
import { Task } from "@/app/leads/types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"

function getSerialNumber(serialId: string) {
  if (!serialId) return ""
  const match = serialId.match(/^([A-Z]+)-(\d+)$/)
  if (match) {
    return `${match[1]}-${parseInt(match[2], 10).toString()}`
  }
  return serialId
}

function getBadgeStyleForStatus(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 hover:bg-green-200 border border-green-200"
    case "in_progress":
      return "bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200"
    case "failed":
      return "bg-red-100 text-red-800 hover:bg-red-200 border border-red-200"
    case "pending":
    default:
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-200"
  }
}

function getStatusContent(task: Task) {
  if (task.status === "in_progress") {
    return (
      <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center">
        <Clock className="h-3 w-3 text-blue-600" />
      </div>
    )
  }
  if (task.status === "failed") {
    return (
      <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center">
        <AlertCircle className="h-3 w-3 text-red-600" />
      </div>
    )
  }
  if (task.status === "completed") {
    return (
      <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
        <Check className="h-3 w-3 text-green-600" />
      </div>
    )
  }
  return (
    <div className="h-5 w-5 rounded-full bg-yellow-100 flex items-center justify-center">
      <Clock className="h-3 w-3 text-yellow-600" />
    </div>
  )
}

export function JourneyTaskSkeleton() {
  return (
    <div className="relative pl-8">
      <div className="absolute left-[-10px] top-3 bg-background rounded-full p-[2px]">
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <div className="bg-muted/40 rounded-lg p-3 border border-border/30">
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center gap-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-16 rounded" />
            <div className="flex items-center gap-1 ml-2">
              <Skeleton className="h-2.5 w-2.5 rounded" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-6 w-6 rounded" />
          </div>
        </div>
        <Skeleton className="h-3 w-full mb-2" />
        <div className="mt-3">
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  )
}

export function JourneyTaskCard({
  task,
  commentsCount,
  onOpen,
  onComplete,
  onEdit,
  onDelete,
}: {
  task: Task
  commentsCount?: number
  onOpen: (task: Task) => void
  onComplete: (taskId: string, event?: React.MouseEvent) => void
  onEdit: (task: Task, event?: React.MouseEvent) => void
  onDelete: (taskId: string, event?: React.MouseEvent) => void
}) {
  return (
    <div className="relative pl-8">
      <div className="absolute left-[-10px] top-3 bg-background rounded-full p-[2px]">
        {getStatusContent(task)}
      </div>
      <div
        className={`bg-muted/40 rounded-lg p-3 border cursor-pointer transition-colors duration-200 hover:shadow-md hover:bg-muted/60 ${
          task.status === "in_progress" ? "border-blue-200" : "border-border/30"
        }`}
        onClick={() => onOpen(task)}
      >
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center gap-2 flex-1">
            <h4 className="text-sm font-medium">{task.title}</h4>
            {task.amount && ["quote", "contract", "payment"].includes(task.type) && (
              <div className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs font-medium inline-flex items-center">
                <Tag className="h-3 w-3 mr-1" />
                ${task.amount.toLocaleString()}
              </div>
            )}
            {task.scheduled_date && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                <Clock className="h-2.5 w-2.5" />
                <span>{format(new Date(task.scheduled_date), "MMM d, yyyy")}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {task.serial_id && (
              <div className="font-mono text-xs text-muted-foreground">
                {getSerialNumber(task.serial_id)}
              </div>
            )}
            <Badge className={getBadgeStyleForStatus(task.status)}>
              {task.status.replace("_", " ")}
            </Badge>
            {task.status === "completed" && (
              <>
                <span className="text-xs text-muted-foreground">&</span>
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200">
                  Closed
                </Badge>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(event) => event.stopPropagation()}
                >
                  <span className="sr-only">Open menu</span>
                  <span className="text-base leading-none">⋮</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {task.status !== "completed" && (
                  <DropdownMenuItem
                    onClick={(event) => {
                      event.stopPropagation()
                      onComplete(task.id, event)
                    }}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Mark Complete
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={(event) => {
                    event.stopPropagation()
                    onEdit(task, event)
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete(task.id, event)
                  }}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
        {commentsCount ? (
          <div className="mt-3 flex items-center gap-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{commentsCount}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
