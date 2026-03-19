"use client"

import React, { memo } from "react"
import { cn } from "@/lib/utils"
import { Filter, LayoutGrid, Activity, CheckCircle2 } from "@/app/components/ui/icons"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Button } from "@/app/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"

import { useLocalization } from "@/app/context/LocalizationContext"

type StatusFilterType = 'all' | 'new' | 'completed'

interface TaskStatusFilterProps {
  selectedFilter: StatusFilterType
  onFilterChange: (filter: StatusFilterType) => void
  onFilterClick?: () => void
  activeFilters?: number
  className?: string
}

export const TaskStatusFilter = memo(function TaskStatusFilter({
  selectedFilter,
  onFilterChange,
  onFilterClick,
  activeFilters = 0,
  className
}: TaskStatusFilterProps) {
  const { t } = useLocalization()
  
  const getFilterConfig = () => ({
    all: {
      label: t('controlCenter.statusFilter.all') || "All",
      icon: <LayoutGrid size={13} className="md:!hidden" />
    },
    new: {
      label: t('controlCenter.statusFilter.new') || "New",
      icon: <Activity size={13} className="md:!hidden" />
    },
    completed: {
      label: t('controlCenter.statusFilter.completed') || "Completed",
      icon: <CheckCircle2 size={13} className="md:!hidden" />
    }
  })

  const filterConfig = getFilterConfig()
  
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="flex items-center justify-center w-full gap-3">
        <Tabs 
          value={selectedFilter} 
          onValueChange={(value) => onFilterChange(value as StatusFilterType)}
          className="flex items-center justify-center"
        >
          <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
            <TooltipProvider delayDuration={300}>
              {(Object.keys(filterConfig) as StatusFilterType[]).map((filter) => {
                const config = filterConfig[filter]

                return (
                  <Tooltip key={filter}>
                    <TooltipTrigger asChild>
                      <TabsTrigger
                        value={filter}
                        className={cn(
                          "h-7 px-3 flex items-center justify-center gap-1.5 rounded-full transition-all duration-200 text-xs font-medium border border-transparent",
                          "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-border",
                          filter === selectedFilter
                            ? "bg-background text-foreground shadow-md ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                        title={config.label}
                      >
                        {config.icon}
                        <span className="tab-label">
                          {config.label}
                        </span>
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={6}>
                      {config.label}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </TooltipProvider>
          </TabsList>
        </Tabs>
      
        {onFilterClick && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full"
                  onClick={onFilterClick}
                >
                  <Filter className="h-4 w-4" />
                  {activeFilters > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                      {activeFilters}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {activeFilters > 0 ? (t('controlCenter.statusFilter.activeFilters') || `Filters ({count} active)`).replace('{count}', activeFilters.toString()) : (t('controlCenter.statusFilter.filters') || "Filters")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  )
})