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
        paddingTop: '6.5px',
        paddingBottom: '6.5px',
        paddingLeft: '9.7px',
        paddingRight: '9.7px',
        height: '31.5px',
        fontSize: '11.3px'
      }}
    >
      <div
        className="rounded-full"
        style={{ 
          backgroundColor: category.color || "#666",
          marginRight: '6.5px',
          height: '9.7px',
          width: '9.7px'
        }}
      />
      <span className="truncate">{category.name}</span>
    </Button>
  )
} 