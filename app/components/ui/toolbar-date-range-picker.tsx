"use client"

import { CalendarDateRangePicker, type DateRangePickerProps } from "./date-range-picker"
import { ToolbarIconButton } from "./toolbar-icon-button"
import { X } from "./icons"
import { cn } from "@/lib/utils"

export function ToolbarDateRangePicker({ className, clearLabel, onClear, ...props }: Omit<DateRangePickerProps, "iconOnly"> & {
  clearLabel: string
  onClear?: () => void
}) {
  return (
    <div className={cn("flex min-w-0 items-start gap-1", className)}>
      <CalendarDateRangePicker {...props} iconOnly />
      {onClear && (
        <ToolbarIconButton label={clearLabel} className="md:h-9 md:w-9" onClick={onClear}>
          <X className="h-4 w-4" aria-hidden />
        </ToolbarIconButton>
      )}
    </div>
  )
}