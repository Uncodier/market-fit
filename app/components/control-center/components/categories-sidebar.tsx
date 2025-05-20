"use client"

import { Button } from "@/app/components/ui/button"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { TaskCategoryButton } from "../task-category-button"
import { TaskCategory } from "@/lib/validations/task"
import { cn } from "@/lib/utils"

interface CategoriesSidebarProps {
  categories: TaskCategory[]
  selectedCategory: TaskCategory | null
  isCollapsed: boolean
  onSelectCategory: (category: TaskCategory | null) => void
}

export function CategoriesSidebar({
  categories,
  selectedCategory,
  isCollapsed,
  onSelectCategory,
}: CategoriesSidebarProps) {
  if (isCollapsed) return null

  return (
    <aside className="fixed left-0 top-0 w-64 h-full border-r bg-background">
      <div className="h-[71px] border-b flex items-center px-6">
        <h2 className="text-lg font-semibold">Categories</h2>
      </div>
      <ScrollArea className="h-[calc(100vh-71px)]">
        <div className="p-4">
          <Button
            variant="ghost"
            className="w-full justify-start mb-2"
            onClick={() => onSelectCategory(null)}
          >
            All Tasks
          </Button>
          {categories.map((category) => (
            <TaskCategoryButton
              key={category.id}
              category={category}
              isSelected={selectedCategory?.id === category.id}
              onClick={() => onSelectCategory(category)}
            />
          ))}
        </div>
      </ScrollArea>
    </aside>
  )
} 