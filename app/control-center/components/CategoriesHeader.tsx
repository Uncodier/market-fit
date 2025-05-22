"use client"

import { cn } from "@/lib/utils"
import { Input } from "@/app/components/ui/input"
import { Search } from "@/app/components/ui/icons"

interface CategoriesHeaderProps {
  isDarkMode?: boolean
  isCollapsed?: boolean
  searchQuery: string
  onSearchChange: (value: string) => void
}

export function CategoriesHeader({
  isDarkMode = false,
  isCollapsed = false,
  searchQuery,
  onSearchChange
}: CategoriesHeaderProps) {
  return (
    <div className={cn(
      "flex items-center justify-center h-[71px] border-b transition-all duration-300 flex-shrink-0",
      "fixed z-[999] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80",
      isCollapsed ? "w-0 opacity-0" : "w-[319px]"
    )}>
      <div className="w-[240px] relative">
        <Input 
          data-command-k-input
          type="text"
          placeholder="Search tasks..." 
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9"
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </div>
    </div>
  )
} 