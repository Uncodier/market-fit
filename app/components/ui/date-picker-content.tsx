import * as React from "react"
import {
  addDays, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek,
} from "date-fns"
import { ChevronLeft, ChevronRight } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { TimeSelect } from "@/app/components/ui/time-select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getDateFnsLocale } from "@/app/lib/date-fns-locale"
import { cn } from "@/lib/utils"
import type { DateEvent, DatePickerMode } from "./date-picker-types"
import { getEventRange } from "./date-picker-presets"
import type { DateRangeSelection } from "@/lib/dates/date-range-presets"

interface DatePickerContentProps {
  mode: DatePickerMode
  date?: Date
  endDate?: Date
  rangePreset?: DateRangeSelection
  currentMonth: Date
  tempStartDate: Date | null
  error: string | null
  disabled: boolean
  navigateMonth: (offset: number) => void
  selectDate: (day: Date) => void
  events: DateEvent[]
  showEvents: boolean
  customEvents: boolean
  selectPreset: (event: DateEvent) => void
  showTimePicker: boolean
  selectedTime: { hours: number; minutes: number }
  timeFormat: '12h' | '24h'
  displayTime: string
  onTimeChange: (hours: number, minutes: number) => void
}

export function DatePickerContent({
  mode, date, endDate, currentMonth, tempStartDate, error, disabled, navigateMonth, selectDate,
  events, showEvents, customEvents, selectPreset, showTimePicker, selectedTime, timeFormat,
  displayTime, onTimeChange, rangePreset,
}: DatePickerContentProps) {
  const { t, locale } = useLocalization()
  const dateLocale = getDateFnsLocale(locale)
  const descriptionId = React.useId()
  const weekOptions = { locale: dateLocale }
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), weekOptions),
    end: endOfWeek(endOfMonth(currentMonth), weekOptions),
  })
  const effectiveDate = tempStartDate || date
  const groupTitle = {
    task: "datePicker.scheduleFor", report: "datePicker.dateRanges", calendar: "datePicker.jumpTo",
    range: "datePicker.presetRanges", default: "datePicker.quickSelect",
  }[mode]

  return (
    <div className="flex flex-col sm:flex-row max-h-[80vh] sm:max-h-none overflow-y-auto sm:overflow-visible">
      <div
        className="p-4 w-full sm:w-[280px] sm:min-w-[280px] flex-shrink-0"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            navigateMonth(event.key === 'ArrowLeft' ? -1 : 1)
          }
        }}
      >
        {mode === 'range' && (
          <div className="mb-3 text-sm flex flex-col gap-1">
            <div className="flex items-center justify-between w-full">
              <Badge variant="outline" className="text-xs py-1 flex-1 justify-center overflow-hidden">
                <span className="truncate">{effectiveDate ? format(effectiveDate, "PP", { locale: dateLocale }) : t("datePicker.selectDate")}</span>
              </Badge>
              <span className="px-2 text-muted-foreground flex-shrink-0">{t("datePicker.to")}</span>
              <Badge variant="outline" className="text-xs py-1 flex-1 justify-center overflow-hidden">
                <span className="truncate">{!tempStartDate && endDate ? format(endDate, "PP", { locale: dateLocale }) : t("datePicker.selectDate")}</span>
              </Badge>
            </div>
            {tempStartDate && <p className="text-xs text-muted-foreground mt-1">{t("datePicker.selectEndDate")}</p>}
          </div>
        )}
        <div className="flex justify-between items-center mb-3">
          <button
            className="h-8 w-8 p-0 hover:bg-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary rounded-md flex items-center justify-center border-0 bg-transparent cursor-pointer"
            onClick={() => navigateMonth(-1)} type="button" disabled={disabled} style={{ zIndex: 1000001 }}
          >
            <span className="sr-only">{t("datePicker.previousMonth")}</span>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-medium text-base rounded px-2 py-1">
            {format(currentMonth, "MMMM yyyy", { locale: dateLocale })}
          </span>
          <button
            className="h-8 w-8 p-0 hover:bg-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary rounded-md flex items-center justify-center border-0 bg-transparent cursor-pointer"
            onClick={() => navigateMonth(1)} type="button" disabled={disabled} style={{ zIndex: 1000001 }}
          >
            <span className="sr-only">{t("datePicker.nextMonth")}</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {eachDayOfInterval({
            start: startOfWeek(currentMonth, weekOptions),
            end: addDays(startOfWeek(currentMonth, weekOptions), 6),
          }).map((weekday) => (
            <div key={weekday.toISOString()} className="text-center text-xs text-muted-foreground py-1"
              style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {format(weekday, "EEEEEE", { locale: dateLocale })}
            </div>
          ))}
          {days.map((day) => {
            const isRangeStart = mode === 'range' && effectiveDate && isSameDay(day, effectiveDate)
            const isRangeEnd = mode === 'range' && !tempStartDate && endDate && isSameDay(day, endDate)
            const isInRange = mode === 'range' && !tempStartDate && date && endDate && day >= startOfDay(date) && day <= endDate
            return (
              <Button
                key={day.toISOString()} variant="ghost" type="button" disabled={disabled}
                aria-label={format(day, "PPPP", { locale: dateLocale })}
                aria-pressed={Boolean(mode === 'range' ? isRangeStart || isRangeEnd : date && isSameDay(day, date))}
                className={cn(
                  "h-8 w-full sm:w-8 p-0 text-sm relative",
                  !isSameMonth(day, currentMonth) && "text-muted-foreground opacity-50",
                  (mode === 'range' ? isRangeStart || isRangeEnd : date && isSameDay(day, date)) && "bg-primary text-primary-foreground",
                  isSameDay(day, new Date()) && !(isRangeStart || isRangeEnd) && "border border-primary",
                  isInRange && !isRangeStart && !isRangeEnd && "bg-primary/20",
                  "hover:bg-muted transition-colors duration-150",
                )}
                onClick={() => selectDate(day)}
              >
                {format(day, "d")}
              </Button>
            )
          })}
        </div>
        {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
      </div>
      {showEvents && events.length > 0 && (
        <div className={cn(
          "border-t sm:border-t-0 sm:border-l p-4 w-full sm:w-[168px] flex flex-col gap-2 overflow-hidden flex-shrink-0",
          mode !== 'range' && "max-h-[300px] overflow-y-auto",
        )}>
          {mode !== 'range' && <div className="text-xs font-medium text-muted-foreground mb-3">{t(groupTitle)}</div>}
          <TooltipProvider delayDuration={300}>
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-2">
              {events.map((event, index) => {
                const reasonId = `${descriptionId}-${index}`
                const disabledReason = (disabled || event.disabled) ? event.disabledReason : undefined
                const selected = !event.disabled && (rangePreset === undefined || rangePreset === event.id)
                  && date && isSameDay(date, event.value)
                  && (mode !== 'range' || (endDate && isSameDay(endDate, getEventRange(event, dateLocale).end)))
                const button = (
                  <button
                    type="button" disabled={disabled || event.disabled}
                    aria-describedby={disabledReason ? reasonId : undefined}
                    aria-pressed={Boolean(selected)}
                    className={cn(
                      "text-xs py-1.5 px-2.5 rounded-md cursor-pointer transition-colors duration-200",
                      "hover:bg-muted w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent",
                      disabledReason && "disabled:pointer-events-none",
                      selected ? "bg-primary/15 font-medium text-primary" : "text-foreground",
                    )}
                    style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    onClick={() => selectPreset(event)}
                  >
                    {event.label}
                  </button>
                )
                return (
                  <div key={event.id || index}>
                    {disabledReason ? (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              tabIndex={0} role="group" aria-label={event.label}
                              aria-disabled="true" aria-describedby={reasonId}
                              className="block w-full rounded-md cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              {button}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">{disabledReason}</TooltipContent>
                        </Tooltip>
                        <span id={reasonId} hidden>{disabledReason}</span>
                      </>
                    ) : button}
                  </div>
                )
              })}
            </div>
          </TooltipProvider>
          {customEvents && (
            <div className="mt-2 pt-2 border-t">
              <div className="text-xs font-medium text-muted-foreground mb-1">{t("datePicker.customRange")}</div>
            </div>
          )}
        </div>
      )}
      {showTimePicker && (
        <div className="border-t sm:border-t-0 sm:border-l p-4 w-full sm:w-[230px] flex flex-col flex-shrink-0">
          <div className="text-xs font-medium text-muted-foreground mb-3">{t("datePicker.selectTime")}</div>
          <TimeSelect
            value={`${selectedTime.hours.toString().padStart(2, "0")}:${selectedTime.minutes.toString().padStart(2, "0")}`}
            onValueChange={(next) => {
              const [hours, minutes] = next.split(":").map(Number)
              if (!Number.isNaN(hours) && !Number.isNaN(minutes)) onTimeChange(hours, minutes)
            }}
            step={15} triggerClassName="h-10"
          />
          {timeFormat === "12h" && (
            <div className="pt-3 mt-3 border-t dark:border-white/5 border-black/5">
              <div className="text-xs text-muted-foreground mb-2">{t("datePicker.selectedTime")}</div>
              <div className="text-center px-3 py-2 bg-muted/30 rounded-md">
                <div className="text-sm font-medium">{displayTime}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}