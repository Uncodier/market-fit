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
      "absolute top-0 z-[1000] flex items-center gap-2 h-[71px] px-4 transition-all duration-300 ease-in-out",
      isCollapsed ? "left-0" : "left-0",
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