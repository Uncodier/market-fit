"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/app/components/ui/button"
import { TaskCategory } from "@/lib/validations/task"

interface TaskCategoryButtonProps {
  category: TaskCategory
  isSelected: boolean
  onClick: () => void
}

export function TaskCategoryButton({
  category,
  isSelected,
  onClick,
}: TaskCategoryButtonProps) {
  return (
    <Button
      variant={isSelected ? "default" : "ghost"}
      className={cn(
        "w-full justify-start",
        isSelected && "bg-primary/10"
      )}
      onClick={onClick}
    >
      <div
        className="mr-2 h-3 w-3 rounded-full"
        style={{ backgroundColor: category.color || "#666" }}
      />
      <span className="truncate">{category.name}</span>
    </Button>
  )
} 