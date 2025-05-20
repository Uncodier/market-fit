"use client"

import { Badge } from "@/app/components/ui/badge"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { formatDistanceToNow } from "date-fns"

interface Task {
  id: string
  title: string
  status: 'completed' | 'in_progress' | 'pending' | 'failed'
  type: string
  scheduled_date: string
}

interface TaskListProps {
  tasks: Task[]
  maxHeight?: string
}

const statusColors = {
  completed: "bg-green-500/10 text-green-700 border-green-300/20",
  in_progress: "bg-blue-500/10 text-blue-700 border-blue-300/20",
  pending: "bg-yellow-500/10 text-yellow-700 border-yellow-300/20",
  failed: "bg-red-500/10 text-red-700 border-red-300/20"
}

export function TaskList({ tasks, maxHeight = "300px" }: TaskListProps) {
  return (
    <ScrollArea className={`w-full`} style={{ maxHeight }}>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between p-2 rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-sm font-medium truncate">{task.title}</span>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={statusColors[task.status]}
                >
                  {task.status.replace('_', ' ')}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(task.scheduled_date), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
} 