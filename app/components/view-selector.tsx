import React from 'react'
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group"
import { LayoutGrid, TableRows, CalendarIcon, Waypoints } from "@/app/components/ui/icons"

export type ViewType = 'table' | 'kanban' | 'calendar' | 'graph'

interface ViewSelectorProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
  showCalendar?: boolean
  showGraph?: boolean
}

export function ViewSelector({ currentView, onViewChange, showCalendar = false, showGraph = false }: ViewSelectorProps) {
  return (
    <ToggleGroup
      type="single"
      value={currentView}
      onValueChange={(value: string) => value && onViewChange(value as ViewType)}
      className="flex gap-1"
    >
      <ToggleGroupItem value="table" aria-label="Toggle table view" className="px-2">
        <TableRows className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="kanban" aria-label="Toggle kanban view" className="px-2">
        <LayoutGrid className="h-4 w-4" />
      </ToggleGroupItem>
      {showCalendar && (
        <ToggleGroupItem value="calendar" aria-label="Toggle calendar view" className="px-2">
          <CalendarIcon className="h-4 w-4" />
        </ToggleGroupItem>
      )}
      {showGraph && (
        <ToggleGroupItem value="graph" aria-label="Toggle graph view" className="px-2">
          <Waypoints className="h-4 w-4" />
        </ToggleGroupItem>
      )}
    </ToggleGroup>
  )
} 