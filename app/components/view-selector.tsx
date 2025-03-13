import React from 'react'
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group"
import { LayoutGrid, TableRows } from "@/app/components/ui/icons"

export type ViewType = 'table' | 'kanban'

interface ViewSelectorProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

export function ViewSelector({ currentView, onViewChange }: ViewSelectorProps) {
  return (
    <ToggleGroup type="single" value={currentView} onValueChange={(value: string) => value && onViewChange(value as ViewType)}>
      <ToggleGroupItem value="table" aria-label="Toggle table view" className="px-2">
        <TableRows className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="kanban" aria-label="Toggle kanban view" className="px-2">
        <LayoutGrid className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  )
} 