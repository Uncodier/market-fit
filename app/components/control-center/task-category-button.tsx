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
      style={{
        paddingTop: '7.2px',
        paddingBottom: '7.2px',
        paddingLeft: '10.8px',
        paddingRight: '10.8px',
        height: '35px',
        fontSize: '12.6px'
      }}
    >
      <div
        className="rounded-full"
        style={{ 
          backgroundColor: category.color || "#666",
          marginRight: '7.2px',
          height: '10.8px',
          width: '10.8px'
        }}
      />
      <span className="truncate">{category.name}</span>
    </Button>
  )
} 