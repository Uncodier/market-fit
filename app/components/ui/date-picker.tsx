"use client"

import * as React from "react"
import { addMonths, format, isSameDay, isValid, startOfMonth } from "date-fns"
import { CalendarIcon, ChevronLeft } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/app/components/ui/dialog"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { cn } from "@/lib/utils"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getDateFnsLocale } from "@/app/lib/date-fns-locale"
import { DatePickerContent } from "./date-picker-content"
import { boundDateEvents, getDefaultDateEvents, getEventRange } from "./date-picker-presets"
import { formatDateRange, getDateRangeError } from "./date-picker-range"
import type { DateEvent, DatePickerProps } from "./date-picker-types"

export type { DateEvent, DateEventPeriod, DateEventType, DatePickerMode, DatePickerProps } from "./date-picker-types"

export function DatePicker({
  date, setDate, className, placeholder, disabled = false, showEvents = true, events,
  customEvents = false, position = "bottom", onRangeSelect, mode = 'default', endDate,
  setEndDate, rangeDisplay, maxRangeDays, showTimePicker = false, timeFormat = '24h', trigger,
}: DatePickerProps) {
  const { t, locale } = useLocalization()
  const dateLocale = getDateFnsLocale(locale)
  const isMobile = useIsMobile()
  const safeDate = date && isValid(date) ? date : undefined
  const safeEndDate = endDate && isValid(endDate) ? endDate : undefined
  const dateTimestamp = safeDate?.getTime()
  const endTimestamp = safeEndDate?.getTime()
  const [currentMonth, setCurrentMonth] = React.useState(() => startOfMonth(safeDate || new Date()))
  const [open, setOpen] = React.useState(false)
  const [tempStartDate, setTempStartDate] = React.useState<Date | null>(null)
  const [selectionError, setSelectionError] = React.useState<string | null>(null)
  const [selectedTime, setSelectedTime] = React.useState(() => ({
    hours: (safeDate || new Date()).getHours(), minutes: (safeDate || new Date()).getMinutes(),
  }))
  const invalidInputError = (date && !safeDate) || (endDate && !safeEndDate)
    ? "Select valid start and end dates."
    : mode === 'range' && (date || endDate) ? getDateRangeError(date, endDate) : null
  const inputError = invalidInputError || (mode === 'range' && date && endDate
    ? getDateRangeError(date, endDate, maxRangeDays) : null)

  React.useEffect(() => {
    if (dateTimestamp !== undefined) {
      const selected = new Date(dateTimestamp)
      setCurrentMonth(startOfMonth(selected))
      setSelectedTime({ hours: selected.getHours(), minutes: selected.getMinutes() })
    }
    setTempStartDate(null)
    setSelectionError(null)
    // Only synchronize when the selected value changes, not on calendar navigation.
  }, [dateTimestamp, endTimestamp])

  React.useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const changeOpen = (next: boolean) => {
    if (disabled && next) return
    setOpen(next)
    setTempStartDate(null)
    setSelectionError(null)
  }

  const displayEvents = events
    ? mode === 'range' || onRangeSelect || maxRangeDays !== undefined
      ? boundDateEvents(events, dateLocale, maxRangeDays)
      : events
    : getDefaultDateEvents(mode, t, dateLocale, maxRangeDays)
  const displayTime = timeFormat === '12h'
    ? `${selectedTime.hours % 12 || 12}:${selectedTime.minutes.toString().padStart(2, '0')} ${t(selectedTime.hours >= 12 ? "datePicker.pm" : "datePicker.am")}`
    : `${selectedTime.hours.toString().padStart(2, '0')}:${selectedTime.minutes.toString().padStart(2, '0')}`
  const displayText = mode === 'range'
    ? rangeDisplay || (safeDate && safeEndDate
      ? formatDateRange(safeDate, safeEndDate, dateLocale)
      : placeholder || t("datePicker.selectDateRange"))
    : safeDate
      ? showTimePicker
        ? t("datePicker.dateAtTime", { date: format(safeDate, "PPP", { locale: dateLocale }), time: displayTime })
        : format(safeDate, "PPP", { locale: dateLocale })
      : placeholder || t("datePicker.selectDate")

  const commitRange = (start: Date, end: Date) => {
    const error = getDateRangeError(start, end, maxRangeDays)
    setTempStartDate(null)
    setSelectionError(error)
    if (error || disabled) return false
    const changed = !safeDate || !safeEndDate || !isSameDay(start, safeDate) || !isSameDay(end, safeEndDate)
    if (changed) {
      setDate(start)
      setEndDate?.(end)
      onRangeSelect?.(start, end)
    }
    setOpen(false)
    return true
  }

  const selectDate = (selectedDate: Date) => {
    if (disabled) return
    if (mode === 'range') {
      if (!tempStartDate) {
        setSelectionError(null)
        setTempStartDate(selectedDate)
      } else {
        // Do not commit partial ranges or silently swap an earlier end date.
        commitRange(tempStartDate, selectedDate)
      }
      return
    }
    const next = new Date(selectedDate)
    if (showTimePicker) next.setHours(selectedTime.hours, selectedTime.minutes, 0, 0)
    if (!safeDate || next.getTime() !== safeDate.getTime()) setDate(next)
    if (onRangeSelect) {
      const range = getEventRange({ label: "", value: selectedDate, type: 'day', period: 'current' }, dateLocale)
      setEndDate?.(range.end)
      onRangeSelect(range.start, range.end)
    }
    changeOpen(false)
  }

  const selectPreset = (event: DateEvent) => {
    if (disabled || event.disabled) return
    const { start, end } = getEventRange(event, dateLocale)
    if (mode === 'range' || onRangeSelect) {
      commitRange(start, end)
      return
    }
    selectDate(event.value)
  }

  const pickerContent = (
    <DatePickerContent
      mode={mode} date={safeDate} endDate={safeEndDate} currentMonth={currentMonth}
      tempStartDate={tempStartDate} error={selectionError || inputError} disabled={disabled}
      navigateMonth={(offset) => { if (!disabled) setCurrentMonth((current) => addMonths(current, offset)) }}
      selectDate={selectDate} events={displayEvents} showEvents={showEvents} customEvents={customEvents}
      selectPreset={selectPreset} showTimePicker={showTimePicker} selectedTime={selectedTime}
      timeFormat={timeFormat} displayTime={displayTime}
      onTimeChange={(hours, minutes) => {
        if (disabled) return
        setSelectedTime({ hours, minutes })
        const next = new Date(safeDate || new Date())
        next.setHours(hours, minutes, 0, 0)
        setDate(next)
      }}
    />
  )

  const triggerButton = (
    <Button
      type="button" variant={mode === 'range' ? "secondary" : "outline"}
      className={cn(
        mode === 'range' ? "h-9" : "h-10", "text-left font-normal",
        mode === 'range' ? "w-auto gap-2" : "w-full",
        mode === 'range' ? "px-3" : "px-3 py-1 flex items-center justify-between",
        mode !== 'range' && "rounded-md border border-input bg-background",
        "focus:outline-none focus-visible:outline-none focus-visible:ring-0",
        mode !== 'range' && "hover:bg-muted hover:border-input hover:no-underline transition-colors duration-200",
        !safeDate && "text-muted-foreground", className,
      )}
      disabled={disabled}
    >
      <div className="flex items-center flex-1 min-w-0 max-w-full overflow-hidden">
        <CalendarIcon className="h-4 w-4 flex-shrink-0 mr-2" />
        <span className="truncate text-sm max-w-full overflow-hidden text-ellipsis">{displayText}</span>
      </div>
      {mode !== 'range' && (
        <div className="opacity-50 ml-1 flex-shrink-0"><ChevronLeft className="h-3 w-3 rotate-90" /></div>
      )}
    </Button>
  )
  const resolvedTrigger = trigger || triggerButton

  return (
    <div className={trigger ? "inline-flex w-auto h-auto shrink-0 flex-none" : "w-full"}>
      {isMobile ? (
        <Dialog open={open} onOpenChange={changeOpen}>
          <DialogTrigger asChild disabled={disabled}>{resolvedTrigger}</DialogTrigger>
          <DialogContent
            className="p-0 w-[95vw] max-w-[400px] gap-0 border-border bg-popover !fixed !inset-auto !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 !rounded-xl"
            showClose={true}
          >
            <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
              <DialogTitle className="text-base font-semibold">{t("datePicker.selectDate")}</DialogTitle>
            </div>
            {pickerContent}
          </DialogContent>
        </Dialog>
      ) : (
        <Popover open={open} onOpenChange={changeOpen}>
          <PopoverTrigger asChild disabled={disabled}>{resolvedTrigger}</PopoverTrigger>
          <PopoverContent
            className="p-0 w-auto max-w-[calc(100vw-2rem)] sm:max-w-none" side={position} align="center"
            onInteractOutside={(event) => {
              const target = event.target as Element | null
              if (target?.closest?.("[data-time-select]")) event.preventDefault()
            }}
          >
            {pickerContent}
          </PopoverContent>
        </Popover>
      )}
      {!open && invalidInputError && <p role="alert" className="mt-1 text-xs text-destructive">{invalidInputError}</p>}
    </div>
  )
}