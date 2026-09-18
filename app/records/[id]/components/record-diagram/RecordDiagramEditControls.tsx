"use client"

import { Button } from "@/app/components/ui/button"
import { ChevronDown, ClipboardList, Copy, LayoutGrid, Palette, Plus, Redo, Trash2, Undo } from "@/app/components/ui/icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import type { RecordDiagramLayout } from "./record-diagram-layout"
import type { RecordDiagramBackground } from "@/app/records/lib/record-diagram"

type RecordDiagramEditControlsProps = {
  canUndo: boolean
  canRedo: boolean
  hasSelection: boolean
  canPaste: boolean
  background: RecordDiagramBackground
  onUndo: () => void
  onRedo: () => void
  onCopy: () => void
  onPaste: () => void
  onDuplicate: () => void
  onDelete: () => void
  onLayout: (layout: RecordDiagramLayout) => void
  onBackground: (background: RecordDiagramBackground) => void
}

export function RecordDiagramEditControls({
  canUndo,
  canRedo,
  hasSelection,
  canPaste,
  background,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onLayout,
  onBackground,
}: RecordDiagramEditControlsProps) {
  return (
    <>
      <div className="mx-1 h-4 w-px bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Arrange selected nodes"
            disabled={!hasSelection}
          >
            <LayoutGrid className="mr-1.5 h-4 w-4" />
            Layout
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onLayout("hierarchy")}>Hierarchy</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onLayout("columns")}>Column</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onLayout("rows")}>Row</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onLayout("grid")}>Grid</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="sm" aria-label="Canvas background">
            <Palette className="mr-1.5 h-4 w-4" />
            Background
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(["dots", "grid", "columns", "rows", "plain"] as const).map((option) => (
            <DropdownMenuItem
              key={option}
              onClick={() => onBackground(option)}
              className={background === option ? "bg-accent" : undefined}
            >
              {option[0].toUpperCase() + option.slice(1)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolbarButton label="Undo" disabled={!canUndo} onClick={onUndo}>
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Redo" disabled={!canRedo} onClick={onRedo}>
        <Redo className="h-4 w-4" />
      </ToolbarButton>
      {hasSelection && (
        <>
          <ToolbarButton label="Copy selected nodes" disabled={false} onClick={onCopy}>
            <Copy className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Paste nodes" disabled={!canPaste} onClick={onPaste}>
            <ClipboardList className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Duplicate selected nodes" disabled={false} onClick={onDuplicate}>
            <span className="relative">
              <Copy className="h-4 w-4" />
              <Plus className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-background" />
            </span>
          </ToolbarButton>
          <ToolbarButton label="Delete selected nodes" disabled={false} onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </ToolbarButton>
        </>
      )}
    </>
  )
}

function ToolbarButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
