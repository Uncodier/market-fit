"use client"

import * as React from "react"
import { endOfDay, startOfDay } from "date-fns"
import { cn } from "@/lib/utils"
import { DatePicker } from "@/app/components/ui/date-picker"
import { CalendarIcon } from "@/app/components/ui/icons"
import { ToolbarIconButton } from "@/app/components/ui/toolbar-icon-button"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { getDateFnsLocale } from "@/app/lib/date-fns-locale"
import { formatDateRange, getDateRangeError } from "./date-picker-range"
import type { DateRangeSelection } from "@/lib/dates/date-range-presets"

export interface DateRangePickerProps {
  className?: string
  onRangeChange?: (startDate: Date, endDate: Date, preset: DateRangeSelection) => void
  initialStartDate?: Date
  initialEndDate?: Date
  rangePreset?: DateRangeSelection
  /** Maximum inclusive calendar days, supplied by the report's server policy. */
  maxRangeDays?: number
  disabled?: boolean
  iconOnly?: boolean
}

export function CalendarDateRangePicker({
  className, onRangeChange, initialStartDate, initialEndDate, rangePreset, maxRangeDays, disabled = false, iconOnly = false,
}: DateRangePickerProps) {
  const { t, locale } = useLocalization()
  const isMobile = useIsMobile()
  const dateLocale = getDateFnsLocale(locale)
  const hasInitialRange = initialStartDate !== undefined || initialEndDate !== undefined
  const initialError = hasInitialRange ? getDateRangeError(initialStartDate, initialEndDate) : null
  const [range, setRange] = React.useState<{ start?: Date; end?: Date; preset: DateRangeSelection }>(() => (
    initialError ? { preset: "custom" } : { start: initialStartDate, end: initialEndDate, preset: rangePreset ?? "custom" }
  ))
  const [error, setError] = React.useState<string | null>(initialError)

  React.useEffect(() => {
    if (initialStartDate === undefined && initialEndDate === undefined) {
      setRange({ preset: "custom" })
      setError(null)
      return
    }
    const nextError = getDateRangeError(initialStartDate, initialEndDate)
    setError(nextError)
    // Keep the previous valid selection rather than inventing replacement dates.
    if (!nextError) setRange((previous) => ({
      start: initialStartDate, end: initialEndDate,
      preset: rangePreset ?? (
        previous.start?.getTime() === initialStartDate?.getTime()
        && previous.end?.getTime() === initialEndDate?.getTime() ? previous.preset : "custom"
      ),
    }))
  }, [initialStartDate, initialEndDate, rangePreset])

  const handleRangeSelect = (start: Date, end: Date, preset: DateRangeSelection) => {
    if (disabled) return
    const nextError = getDateRangeError(start, end, maxRangeDays)
    setError(nextError)
    if (nextError) return
    const next = { start: startOfDay(start), end: endOfDay(end), preset }
    setRange(next)
    onRangeChange?.(next.start, next.end, preset)
  }
  const label = t("datePicker.selectDateRange")
  const rangeDisplay = range.start && range.end
    ? formatDateRange(range.start, range.end, dateLocale)
    : label

  return (
    <div className={cn("flex flex-col items-start", className)}>
      <DatePicker
        date={range.start} endDate={range.end}
        rangePreset={range.preset}
        setDate={() => {}} setEndDate={() => {}}
        className="w-full" mode="range" onRangeSelect={handleRangeSelect}
        rangeDisplay={rangeDisplay} maxRangeDays={maxRangeDays} disabled={disabled}
        trigger={iconOnly && !isMobile ? (
          <ToolbarIconButton label={label} tooltipLabel={rangeDisplay} variant="secondary" disabled={disabled}
            className={cn("md:h-9 md:w-9", range.start && range.end && "ring-1 ring-inset ring-primary")}>
            <CalendarIcon className="h-4 w-4" aria-hidden />
          </ToolbarIconButton>
        ) : undefined}
      />
      {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}