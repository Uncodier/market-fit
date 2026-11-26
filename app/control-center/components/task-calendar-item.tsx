import { Badge } from "@/app/components/ui/badge"
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { Task } from "@/app/types"

export type CalendarViewMode = 'year' | 'month' | 'week' | 'day'

export interface ExtendedTask extends Task {
  leadName?: string
  assigneeName?: string
}

function TaskStatusDot({ status }: { status: ExtendedTask['status'] }) {
  return (
    <div className={cn(
      "w-2 h-2 rounded-full",
      status === 'completed' && "bg-green-500",
      status === 'in_progress' && "bg-blue-500",
      status === 'pending' && "bg-yellow-500",
      status === 'failed' && "bg-red-500"
    )} />
  )
}

function getLeadInitials(name: string | undefined) {
  if (!name) return "L"
  return name.split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
}

// Extract numeric part from serial_id
function getSerialNumber(serialId: string) {
  if (!serialId) return ""
  // Extract number after the dash and remove leading zeros
  const match = serialId.match(/-(\d+)$/)
  if (match) {
    return parseInt(match[1], 10).toString()
  }
  return serialId
}

export function TaskItem({ task, onClick, showDay, showTime, showSerialId }: {
  task: ExtendedTask
  onClick: (task: ExtendedTask) => void
  showDay?: boolean
  showTime?: boolean
  showSerialId?: boolean
}) {
  const taskDate = new Date(task.scheduled_date)
  const timeStr = taskDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  const dayStr = taskDate.getDate().toString()

  return (
    <div
      onClick={() => onClick(task)}
      className="cursor-pointer group"
    >
      <Badge
        variant="outline"
        className={cn(
          "flex items-center gap-2 text-xs w-full pr-2 pl-1",
          task.status === 'completed' && "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
          task.status === 'in_progress' && "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
          task.status === 'pending' && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
          task.status === 'failed' && "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
        )}
      >
        <Avatar className="h-5 w-5 mr-1.5">
          <AvatarFallback className="text-[10px] bg-primary/10">
            {getLeadInitials(task.leadName)}
          </AvatarFallback>
        </Avatar>
        <span className="flex-1 truncate">{task.title}</span>
        {showSerialId && task.serial_id && (
          <span className="font-mono text-xs text-muted-foreground bg-background px-1 py-0.5 rounded">
            {getSerialNumber(task.serial_id)}
          </span>
        )}
        {(showDay || showTime) && (
          <span className="text-muted-foreground mr-2">
            {showDay && dayStr}
            {showTime && timeStr}
          </span>
        )}
        <TaskStatusDot status={task.status} />
      </Badge>
    </div>
  )
}

