"use client"

import { type ReactNode, useState } from "react"
import { format } from "date-fns"
import { Card, CardHeader, CardTitle } from "@/app/components/ui/card"
import { CalendarIcon, Info } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Button } from "@/app/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface BaseKpiWidgetProps {
  title: string
  tooltipText?: string
  value: ReactNode
  icon?: ReactNode
  changeText: string
  isPositiveChange?: boolean
  isLoading: boolean
  showDatePicker?: boolean
  startDate?: Date
  endDate?: Date
  onDateChange?: (start: Date, end: Date) => void
  segmentBadge?: boolean
  customStatus?: ReactNode
  className?: string
}

export function BaseKpiWidget({
  title, tooltipText, value, icon, changeText, isPositiveChange, isLoading,
  showDatePicker = false, startDate, endDate, onDateChange,
  segmentBadge = false, customStatus, className,
}: BaseKpiWidgetProps) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [firstWord, ...comparison] = changeText.split(" ")
  const change = Number.parseFloat(firstWord.replace(/[^0-9.-]+/g, ""))
  const hasDirection = isPositiveChange !== undefined && Number.isFinite(change) && change !== 0
  const direction = hasDirection ? (change > 0 ? "↑" : "↓") : "→"

  return (
    <Card data-report-kpi="" className={cn("grid grid-rows-[auto_auto_1fr] gap-y-0 min-h-[104px] min-w-0", className)}
      aria-busy={isLoading} role={isLoading ? "status" : undefined} aria-label={isLoading ? `Loading ${title}` : undefined}>
      <CardHeader data-kpi-slot="title" className="flex flex-row items-start justify-between gap-2 space-y-0 px-3 pt-3 pb-0 sm:px-4">
        <CardTitle className="min-w-0 text-sm font-medium leading-5 break-words">
          {title}
          {segmentBadge && <span className="ml-1 text-xs text-muted-foreground">(Segment)</span>}
        </CardTitle>
        <div className="flex min-h-5 min-w-4 shrink-0 items-center gap-2">
          {icon && <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center text-muted-foreground">{icon}</span>}
          {tooltipText && <TooltipProvider><Tooltip><TooltipTrigger asChild>
            <button type="button" aria-label={`About ${title}`} className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Info className="h-4 w-4" />
            </button>
          </TooltipTrigger><TooltipContent className="max-w-xs">{tooltipText}</TooltipContent></Tooltip></TooltipProvider>}
          {showDatePicker && startDate && endDate && (
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs px-2 py-1 h-auto">
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {format(startDate, "MMM dd")} – {format(endDate, "MMM dd")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <DatePicker date={startDate} endDate={endDate} mode="range"
                  setDate={(date) => onDateChange?.(date, endDate)}
                  setEndDate={(date) => onDateChange?.(startDate, date)}
                  onRangeSelect={(start, end) => { onDateChange?.(start, end); setIsDatePickerOpen(false) }} />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </CardHeader>
      <div data-kpi-slot="value" className="min-w-0 px-3 pt-2 text-xl font-bold leading-8 tabular-nums break-words sm:px-4 sm:text-2xl sm:leading-8">
        {isLoading ? <Skeleton aria-hidden="true" className="h-8 w-32 max-w-full motion-reduce:animate-none" /> : value ?? "—"}
      </div>
      <div data-kpi-slot="status" className="min-h-[48px] min-w-0 px-3 pt-1 pb-3 text-xs leading-4 text-muted-foreground sm:min-h-8 sm:px-4">
        {isLoading ? <Skeleton aria-hidden="true" className="h-4 w-24 max-w-full motion-reduce:animate-none" /> :
            customStatus || <p className="min-h-4">
              {isPositiveChange === undefined ? changeText : <>
                <span className={cn("font-medium", hasDirection ? (isPositiveChange ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400") : "text-foreground")}>
                  <span aria-hidden="true">{direction} </span>{firstWord}
                </span>{comparison.length > 0 && ` ${comparison.join(" ")}`}
              </>}
            </p>}
      </div>
    </Card>
  )
}