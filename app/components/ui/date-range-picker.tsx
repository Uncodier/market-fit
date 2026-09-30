"use client"

import * as React from "react"
import { endOfDay, startOfDay } from "date-fns"
import { cn } from "@/lib/utils"
import { DatePicker } from "@/app/components/ui/date-picker"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getDateFnsLocale } from "@/app/lib/date-fns-locale"
import { formatDateRange, getDateRangeError } from "./date-picker-range"

export interface DateRangePickerProps {
  className?: string
  onRangeChange?: (startDate: Date, endDate: Date) => void
  initialStartDate?: Date
  initialEndDate?: Date
  /** Maximum inclusive calendar days, supplied by the report's server policy. */
  maxRangeDays?: number
  disabled?: boolean
}

export function CalendarDateRangePicker({
  className, onRangeChange, initialStartDate, initialEndDate, maxRangeDays, disabled = false,
}: DateRangePickerProps) {
  const { t, locale } = useLocalization()
  const dateLocale = getDateFnsLocale(locale)
  const hasInitialRange = initialStartDate !== undefined || initialEndDate !== undefined
  const initialError = hasInitialRange ? getDateRangeError(initialStartDate, initialEndDate) : null
  const [range, setRange] = React.useState<{ start?: Date; end?: Date }>(() => (
    initialError ? {} : { start: initialStartDate, end: initialEndDate }
  ))
  const [error, setError] = React.useState<string | null>(initialError)

  React.useEffect(() => {
    if (initialStartDate === undefined && initialEndDate === undefined) {
      setRange({})
      setError(null)
      return
    }
    const nextError = getDateRangeError(initialStartDate, initialEndDate)
    setError(nextError)
    // Keep the previous valid selection rather than inventing replacement dates.
    if (!nextError) setRange({ start: initialStartDate, end: initialEndDate })
  }, [initialStartDate, initialEndDate])

  const handleRangeSelect = (start: Date, end: Date) => {
    if (disabled) return
    const nextError = getDateRangeError(start, end, maxRangeDays)
    setError(nextError)
    if (nextError) return
    const next = { start: startOfDay(start), end: endOfDay(end) }
    setRange(next)
    onRangeChange?.(next.start, next.end)
  }
  const rangeDisplay = range.start && range.end
    ? formatDateRange(range.start, range.end, dateLocale)
    : t("datePicker.selectDateRange")

  return (
    <div className={cn("flex flex-col items-start", className)}>
      <DatePicker
        date={range.start} endDate={range.end}
        setDate={() => {}} setEndDate={() => {}}
        className="w-full" mode="range" onRangeSelect={handleRangeSelect}
        rangeDisplay={rangeDisplay} maxRangeDays={maxRangeDays} disabled={disabled}
      />
      {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}