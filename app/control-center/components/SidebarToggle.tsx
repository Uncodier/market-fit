"use client"

import { Button } from "@/app/components/ui/button"
import { ChevronLeft, ChevronRight } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"

interface SidebarToggleProps {
  isCollapsed: boolean
  onToggle: () => void
  className?: string
}

export function SidebarToggle({ 
  isCollapsed, 
  onToggle,
  className
}: SidebarToggleProps) {
  return (
    <div className={cn(
      "flex flex-shrink-0 items-center justify-center transition-all duration-300 ease-in-out",
      className
    )}>
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="h-8 w-8 rounded-full bg-background transition-all duration-300 ease-in-out hover:bg-muted"
        aria-label={isCollapsed ? "Show categories" : "Hide categories"}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 transition-transform duration-200" />
        ) : (
          <ChevronLeft className="h-4 w-4 transition-transform duration-200" />
        )}
      </Button>
    </div>
  )
} 