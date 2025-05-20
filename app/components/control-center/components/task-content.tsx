"use client"

import { Task } from "@/lib/validations/task"
import { TaskKanbanView } from "../task-kanban-view"
import { cn } from "@/lib/utils"

interface TaskContentProps {
  tasks: Task[]
  isCollapsed: boolean
  onUpdateTaskStatus: (taskId: string, newStatus: string) => Promise<void>
  onTaskClick: (task: Task) => void
}

export function TaskContent({
  tasks,
  isCollapsed,
  onUpdateTaskStatus,
  onTaskClick,
}: TaskContentProps) {
  return (
    <main className={cn(
      "flex-1 min-h-screen transition-all duration-300 ease-in-out",
      isCollapsed ? "pl-0" : "pl-64"
    )}>
      <div className="pt-[71px]">
        <TaskKanbanView
          tasks={tasks}
          onUpdateTaskStatus={onUpdateTaskStatus}
          onTaskClick={onTaskClick}
        />
      </div>
    </main>
  )
} 