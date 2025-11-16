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
      <div className="border-b flex items-center" style={{ height: '64px', paddingLeft: '21.6px', paddingRight: '21.6px' }}>
        <h2 className="font-semibold" style={{ fontSize: '14.58px' }}>Categories</h2>
      </div>
      <ScrollArea style={{ height: 'calc(100vh - 64px)' }}>
        <div style={{ padding: '14.4px' }}>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => onSelectCategory(null)}
            style={{
              paddingTop: '6.5px',
              paddingBottom: '6.5px',
              paddingLeft: '9.7px',
              paddingRight: '9.7px',
              height: '31.5px',
              fontSize: '11.3px',
              marginBottom: '6.5px'
            }}
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