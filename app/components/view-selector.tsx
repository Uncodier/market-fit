import React from 'react'
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group"
import { LayoutGrid, TableRows, CalendarIcon, Waypoints } from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"

export type ViewType = 'table' | 'kanban' | 'calendar' | 'graph'

interface ViewSelectorProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
  showCalendar?: boolean
  showGraph?: boolean
  labels?: Partial<Record<ViewType, string>>
}

export function ViewSelector({ currentView, onViewChange, showCalendar = false, showGraph = false, labels }: ViewSelectorProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <ToggleGroup
        type="single"
        value={currentView}
        onValueChange={(value: string) => value && onViewChange(value as ViewType)}
        className="flex gap-1"
      >
        <ViewToggle value="table" label={labels?.table ?? 'Toggle table view'}>
          <TableRows className="h-4 w-4" />
        </ViewToggle>
        <ViewToggle value="kanban" label={labels?.kanban ?? 'Toggle kanban view'}>
          <LayoutGrid className="h-4 w-4" />
        </ViewToggle>
        {showCalendar && (
          <ViewToggle value="calendar" label={labels?.calendar ?? 'Toggle calendar view'}>
            <CalendarIcon className="h-4 w-4" />
          </ViewToggle>
        )}
        {showGraph && (
          <ViewToggle value="graph" label={labels?.graph ?? 'Toggle graph view'}>
            <Waypoints className="h-4 w-4" />
          </ViewToggle>
        )}
      </ToggleGroup>
    </TooltipProvider>
  )
}

function ViewToggle({ value, label, children }: { value: ViewType; label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ToggleGroupItem value={value} aria-label={label} className="px-2">
          {children}
        </ToggleGroupItem>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
