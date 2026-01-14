"use client"

import React, { memo } from "react"
import { cn } from "@/lib/utils"
import { Filter } from "@/app/components/ui/icons"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Button } from "@/app/components/ui/button"

type StatusFilterType = 'all' | 'new' | 'completed'

interface TaskStatusFilterProps {
  selectedFilter: StatusFilterType
  onFilterChange: (filter: StatusFilterType) => void
  onFilterClick?: () => void
  activeFilters?: number
  className?: string
}

const getFilterConfig = () => ({
  all: {
    label: "All"
  },
  new: {
    label: "New"
  },
  completed: {
    label: "Completed"
  }
})

export const TaskStatusFilter = memo(function TaskStatusFilter({
  selectedFilter,
  onFilterChange,
  onFilterClick,
  activeFilters = 0,
  className
}: TaskStatusFilterProps) {
  const filterConfig = getFilterConfig()
  
  return (
    <div className={cn("px-4 py-3 border-b border-border/30 flex items-center justify-center min-h-[56px]", className)}>
      <div className="flex items-center justify-center w-full gap-3">
        <Tabs 
          value={selectedFilter} 
          onValueChange={(value) => onFilterChange(value as StatusFilterType)}
          className="flex items-center justify-center"
        >
          <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
            {(Object.keys(filterConfig) as StatusFilterType[]).map((filter) => {
              const config = filterConfig[filter]

              return (
                <TabsTrigger
                  key={filter}
                  value={filter}
                  className="h-7 px-3 flex items-center justify-center rounded-full transition-all duration-200 text-xs font-medium"
                  title={config.label}
                >
                  {config.label}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      
        {onFilterClick && (
          <Button
            variant="secondary"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onFilterClick}
          >
            <Filter className="h-4 w-4" />
            {activeFilters > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </Button>
        )}
      </div>
    </div>
  )
})