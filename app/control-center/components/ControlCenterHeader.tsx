"use client"

import { cn } from "@/lib/utils"
import { Clock, PlayCircle, CheckCircle2, XCircle, Ban, Filter } from "@/app/components/ui/icons"
import { SidebarToggle } from "./SidebarToggle"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Button } from "@/app/components/ui/button"

// Define task statuses
const TASK_STATUSES = [
  { id: "all", name: "All" },
  { id: "pending", name: "Pending" },
  { id: "in_progress", name: "In Progress" },
  { id: "completed", name: "Completed" },
  { id: "failed", name: "Failed" },
  { id: "canceled", name: "Canceled" }
] as const

type TaskStatusFilter = "all" | "pending" | "in_progress" | "completed" | "failed" | "canceled"

interface ControlCenterHeaderProps {
  isSidebarCollapsed: boolean
  toggleSidebar: () => void
  rightContent?: React.ReactNode
  currentStatus: TaskStatusFilter
  onStatusChange: (status: TaskStatusFilter) => void
  onFilterClick?: () => void
  activeFilters?: number
}

export function ControlCenterHeader({
  isSidebarCollapsed,
  toggleSidebar,
  rightContent,
  currentStatus,
  onStatusChange,
  onFilterClick,
  activeFilters = 0
}: ControlCenterHeaderProps) {
  return (
    <div className="border-b flex-none h-[71px] flex items-center fixed w-[-webkit-fill-available] z-[999] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* SidebarToggle positioned absolutely */}
      <SidebarToggle
        isCollapsed={isSidebarCollapsed}
        onToggle={toggleSidebar}
        className="absolute top-0 left-0"
      />
      
      <div className={cn(
        "w-full flex items-center justify-between transition-all duration-300 ease-in-out ml-[120px] mr-16"
      )}>
        <div className="flex items-center gap-8">
          <Tabs value={currentStatus} onValueChange={(value) => onStatusChange(value as TaskStatusFilter)}>
            <TabsList>
              {TASK_STATUSES.map(status => (
                <TabsTrigger 
                  key={status.id} 
                  value={status.id} 
                  className="text-sm font-medium flex items-center gap-2"
                  title={status.name}
                >
                  <span>{status.name}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={onFilterClick}
          >
            <Filter className="h-4 w-4" />
            {activeFilters > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </Button>
        </div>
        {rightContent}
      </div>
    </div>
  )
} 