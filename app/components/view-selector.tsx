import React from 'react'
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group"
import { LayoutGrid, TableRows, CalendarIcon, Waypoints } from "@/app/components/ui/icons"

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
    <ToggleGroup
      type="single"
      value={currentView}
      onValueChange={(value: string) => value && onViewChange(value as ViewType)}
      className="flex gap-1"
    >
      <ToggleGroupItem value="table" aria-label={labels?.table ?? 'Toggle table view'} className="px-2">
        <TableRows className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="kanban" aria-label={labels?.kanban ?? 'Toggle kanban view'} className="px-2">
        <LayoutGrid className="h-4 w-4" />
      </ToggleGroupItem>
      {showCalendar && (
        <ToggleGroupItem value="calendar" aria-label={labels?.calendar ?? 'Toggle calendar view'} className="px-2">
          <CalendarIcon className="h-4 w-4" />
        </ToggleGroupItem>
      )}
      {showGraph && (
        <ToggleGroupItem value="graph" aria-label={labels?.graph ?? 'Toggle graph view'} className="px-2">
          <Waypoints className="h-4 w-4" />
        </ToggleGroupItem>
      )}
    </ToggleGroup>
  )
} 