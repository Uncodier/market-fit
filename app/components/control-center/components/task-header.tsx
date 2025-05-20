"use client"

import { Button } from "@/app/components/ui/button"
import { TaskCategory } from "@/lib/validations/task"
import { cn } from "@/lib/utils"

interface TaskHeaderProps {
  selectedCategory: TaskCategory | null
  isCollapsed: boolean
  onCreateTask: () => void
}

export function TaskHeader({
  selectedCategory,
  isCollapsed,
  onCreateTask,
}: TaskHeaderProps) {
  return (
    <div className={cn(
      "h-[71px] border-b flex items-center justify-between p-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/95 fixed top-0 right-0 z-20 transition-all duration-300 ease-in-out",
      isCollapsed ? "left-0" : "left-64"
    )}>
      <h1 className="text-2xl font-bold">
        {selectedCategory ? selectedCategory.name : "All Tasks"}
      </h1>
      <Button variant="default" onClick={onCreateTask}>
        Create Task
      </Button>
    </div>
  )
} 