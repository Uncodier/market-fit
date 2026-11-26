"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { ChevronLeft, ChevronRight } from "@/app/components/ui/icons"
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { useCurrentTime } from "@/app/hooks/useCurrentTime"

import { useLocalization } from "@/app/context/LocalizationContext"

import { TaskCalendarViews, getWeekDates } from "./task-calendar-views"
import type { ExtendedTask, CalendarViewMode } from "./task-calendar-item"

interface TaskCalendarProps {
  tasks: ExtendedTask[]
  onTaskClick: (task: ExtendedTask, order?: ExtendedTask[]) => void
}

export function TaskCalendar({ tasks, onTaskClick }: TaskCalendarProps) {
  const { t } = useLocalization()
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month')
  
  const time = useCurrentTime()

  useEffect(() => {
    if (viewMode !== 'day') return
    document.querySelector('[data-calendar-current-hour]')?.scrollIntoView({
      block: 'center',
      behavior: 'smooth'
    })
  }, [viewMode, selectedDate])

  // Helper function to create a new date while preserving the day
  const createNewDatePreservingDay = (
    originalDate: Date,
    newYear: number,
    newMonth: number
  ) => {
    const targetDay = originalDate.getDate()
    const lastDayOfNewMonth = new Date(newYear, newMonth + 1, 0).getDate()
    const day = Math.min(targetDay, lastDayOfNewMonth)
    
    const newDate = new Date(originalDate)
    newDate.setFullYear(newYear)
    newDate.setMonth(newMonth)
    newDate.setDate(day)
    return newDate
  }

  // Calendar navigation
  const nextPeriod = () => {
    setSelectedDate(prevDate => {
      const newDate = new Date(prevDate)
      const currentDay = newDate.getDate()
      const currentMonth = newDate.getMonth()
      const currentYear = newDate.getFullYear()

      switch (viewMode) {
        case 'year':
          return createNewDatePreservingDay(
            newDate,
            currentYear + 1,
            currentMonth
          )
        case 'month':
          return createNewDatePreservingDay(
            newDate,
            currentMonth === 11 ? currentYear + 1 : currentYear,
            currentMonth === 11 ? 0 : currentMonth + 1
          )
        case 'week':
          newDate.setDate(currentDay + 7)
          return newDate
        case 'day':
          newDate.setDate(currentDay + 1)
          return newDate
        default:
          return newDate
      }
    })
  }

  const prevPeriod = () => {
    setSelectedDate(prevDate => {
      const newDate = new Date(prevDate)
      const currentDay = newDate.getDate()
      const currentMonth = newDate.getMonth()
      const currentYear = newDate.getFullYear()

      switch (viewMode) {
        case 'year':
          return createNewDatePreservingDay(
            newDate,
            currentYear - 1,
            currentMonth
          )
        case 'month':
          return createNewDatePreservingDay(
            newDate,
            currentMonth === 0 ? currentYear - 1 : currentYear,
            currentMonth === 0 ? 11 : currentMonth - 1
          )
        case 'week':
          newDate.setDate(currentDay - 7)
          return newDate
        case 'day':
          newDate.setDate(currentDay - 1)
          return newDate
        default:
          return newDate
      }
    })
  }

  // Get period label with correct date formatting
  const getPeriodLabel = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }

    switch (viewMode) {
      case 'year':
        return selectedDate.getFullYear().toString()
      case 'month':
        return new Date(selectedDate).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric'
        })
      case 'week': {
        const weekDates = getWeekDates(selectedDate)
        const start = weekDates[0].toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })
        const end = weekDates[6].toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
        return `${start} - ${end}`
      }
      case 'day':
        return selectedDate.toLocaleDateString('en-US', options)
      default:
        return ''
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        <style jsx>{`
          .tasks-container {
            display: grid;
            grid-auto-rows: min-content;
            gap: 0.25rem;
            overflow: hidden;
            max-height: 100%;
          }
        `}</style>
        {/* Calendar Header */}
        <div className="flex items-center justify-between py-6 border-b pl-8 pr-[33px]">
          <div className="flex-1 flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const now = new Date()
                setSelectedDate(now)
                if (viewMode === 'day') {
                  requestAnimationFrame(() => {
                    document.querySelector('[data-calendar-current-hour]')?.scrollIntoView({
                      block: 'center',
                      behavior: 'smooth'
                    })
                  })
                }
              }}
              className={cn(
                "text-sm font-medium",
                time.isToday(selectedDate.toISOString().split('T')[0]) && "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {t('controlCenter.calendar.today') || 'Today'}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={prevPeriod}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold min-w-[200px] text-center">
              {getPeriodLabel()}
            </h2>
            <Button variant="ghost" size="sm" onClick={nextPeriod}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 flex justify-end">
            <ToggleGroup 
              type="single" 
              value={viewMode} 
              onValueChange={(value: string) => value && setViewMode(value as CalendarViewMode)}
            >
              <ToggleGroupItem value="year" aria-label="Year view" className="px-3">
                {t('controlCenter.calendar.year') || 'Year'}
              </ToggleGroupItem>
              <ToggleGroupItem value="month" aria-label="Month view" className="px-3">
                {t('controlCenter.calendar.month') || 'Month'}
              </ToggleGroupItem>
              <ToggleGroupItem value="week" aria-label="Week view" className="px-3">
                {t('controlCenter.calendar.week') || 'Week'}
              </ToggleGroupItem>
              <ToggleGroupItem value="day" aria-label="Day view" className="px-3">
                {t('controlCenter.calendar.day') || 'Day'}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* Calendar Content */}
        <div className="p-8">
          <TaskCalendarViews {...{ tasks, selectedDate, viewMode, onTaskClick, time }} />
        </div>
      </CardContent>
    </Card>
  )
}
