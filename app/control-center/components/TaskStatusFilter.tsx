"use client"

import React, { memo } from "react"
import { cn } from "@/lib/utils"
import { Filter, LayoutGrid, Activity, CheckCircle2 } from "@/app/components/ui/icons"
import { Tabs } from "@/app/components/ui/tabs"
import { ResponsiveTabsList } from "@/app/components/ui/responsive-tabs-list"
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
      icon: <LayoutGrid size={13} className="shrink-0 md:!hidden" />
    },
    new: {
      label: t('controlCenter.statusFilter.new') || "New",
      icon: <Activity size={13} className="shrink-0 md:!hidden" />
    },
    completed: {
      label: t('controlCenter.statusFilter.completed') || "Completed",
      icon: <CheckCircle2 size={13} className="shrink-0 md:!hidden" />
    }
  })

  const filterConfig = getFilterConfig()
  
  return (
    <div className={cn("flex w-full min-w-0 items-center md:w-auto", className)}>
      <div className="flex min-w-0 w-full items-center gap-3">
        <Tabs 
          value={selectedFilter} 
          onValueChange={(value) => onFilterChange(value as StatusFilterType)}
          className="w-full min-w-0 md:w-auto"
        >
          <ResponsiveTabsList
            tabs={(Object.keys(filterConfig) as StatusFilterType[]).map((filter) => ({
              value: filter,
              label: filterConfig[filter].label,
              icon: filterConfig[filter].icon,
            }))}
            activeTab={selectedFilter}
            onTabChange={(value) => onFilterChange(value as StatusFilterType)}
            className="h-8 p-0.5 bg-muted/30 rounded-full"
            triggerClassName="h-7 px-3 text-xs font-medium"
          />
        </Tabs>
      
        {onFilterClick && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="relative h-9 w-9 shrink-0 rounded-full"
                  onClick={onFilterClick}
                  aria-label={t('controlCenter.statusFilter.filters') || "Filters"}
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