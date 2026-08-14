"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/app/components/ui/button"
import { ChevronLeft, ChevronRight } from "@/app/components/ui/icons"
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { useCurrentTime } from "@/app/hooks/useCurrentTime"
import { Reservation } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { CalendarViewMode, createNewDatePreservingDay, getWeekDates } from "./reservation-calendar-utils"
import {
  ReservationDayView,
  ReservationMonthView,
  ReservationWeekView,
  ReservationYearView,
} from "./reservation-calendar-views"
import type { CalendarTimeSlot } from "./reservation-calendar-hour-select"

interface ReservationCalendarProps {
  reservations: Reservation[]
  viewMode: "service" | "calendar"
  onReservationClick?: (reservation: Reservation) => void
  onCreateSlot?: (slot: CalendarTimeSlot) => void
}

export function ReservationCalendar({
  reservations,
  viewMode: listGroupMode,
  onReservationClick,
  onCreateSlot,
}: ReservationCalendarProps) {
  const { t } = useLocalization()
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month")
  const dayViewRef = useRef<HTMLDivElement>(null)
  const { currentTime, isToday, getCurrentTimePosition } = useCurrentTime()

  useEffect(() => {
    if (viewMode === "day" && dayViewRef.current) {
      const currentHour = currentTime.getHours()
      const scrollPosition = currentHour * 80 - dayViewRef.current.clientHeight / 2 + 40
      dayViewRef.current.scrollTo({ top: Math.max(0, scrollPosition), behavior: "smooth" })
    }
  }, [viewMode, currentTime])

  const nextPeriod = () => {
    setSelectedDate((prevDate) => {
      const currentDay = prevDate.getDate()
      const currentMonth = prevDate.getMonth()
      const currentYear = prevDate.getFullYear()
      switch (viewMode) {
        case "year":
          return createNewDatePreservingDay(prevDate, currentYear + 1, currentMonth)
        case "month":
          return createNewDatePreservingDay(
            prevDate,
            currentMonth === 11 ? currentYear + 1 : currentYear,
            currentMonth === 11 ? 0 : currentMonth + 1
          )
        case "week": {
          const next = new Date(prevDate)
          next.setDate(currentDay + 7)
          return next
        }
        case "day": {
          const next = new Date(prevDate)
          next.setDate(currentDay + 1)
          return next
        }
        default:
          return prevDate
      }
    })
  }

  const prevPeriod = () => {
    setSelectedDate((prevDate) => {
      const currentDay = prevDate.getDate()
      const currentMonth = prevDate.getMonth()
      const currentYear = prevDate.getFullYear()
      switch (viewMode) {
        case "year":
          return createNewDatePreservingDay(prevDate, currentYear - 1, currentMonth)
        case "month":
          return createNewDatePreservingDay(
            prevDate,
            currentMonth === 0 ? currentYear - 1 : currentYear,
            currentMonth === 0 ? 11 : currentMonth - 1
          )
        case "week": {
          const prev = new Date(prevDate)
          prev.setDate(currentDay - 7)
          return prev
        }
        case "day": {
          const prev = new Date(prevDate)
          prev.setDate(currentDay - 1)
          return prev
        }
        default:
          return prevDate
      }
    })
  }

  const reservationsByDate = reservations.reduce((acc, reservation) => {
    const dateStr = reservation.start_time.split("T")[0]
    if (!acc[dateStr]) acc[dateStr] = []
    acc[dateStr].push(reservation)
    return acc
  }, {} as Record<string, Reservation[]>)

  const getPeriodLabel = () => {
    switch (viewMode) {
      case "year":
        return selectedDate.getFullYear().toString()
      case "month":
        return new Date(selectedDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      case "week": {
        const weekDates = getWeekDates(selectedDate)
        const start = weekDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })
        const end = weekDates[6].toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        return `${start} - ${end}`
      }
      case "day":
        return selectedDate.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      default:
        return ""
    }
  }

  const handleReservationClick = (reservation: Reservation) => {
    onReservationClick?.(reservation)
  }

  const weekdayLabels = [
    t("common.days.short.sun") || "Sun",
    t("common.days.short.mon") || "Mon",
    t("common.days.short.tue") || "Tue",
    t("common.days.short.wed") || "Wed",
    t("common.days.short.thu") || "Thu",
    t("common.days.short.fri") || "Fri",
    t("common.days.short.sat") || "Sat",
  ]

  const renderCalendarContent = () => {
    const shared = {
      reservationsByDate,
      isToday,
      onReservationClick: handleReservationClick,
      onCreateSlot,
    }
    switch (viewMode) {
      case "month":
        return <ReservationMonthView selectedDate={selectedDate} weekdayLabels={weekdayLabels} {...shared} />
      case "week":
        return (
          <ReservationWeekView
            selectedDate={selectedDate}
            currentTime={currentTime}
            timePosition={getCurrentTimePosition()}
            {...shared}
          />
        )
      case "day":
        return (
          <ReservationDayView
            selectedDate={selectedDate}
            listGroupMode={listGroupMode}
            dayViewRef={dayViewRef}
            currentTime={currentTime}
            timePosition={getCurrentTimePosition()}
            {...shared}
          />
        )
      case "year":
        return (
          <ReservationYearView
            selectedDate={selectedDate}
            reservations={reservations}
            onReservationClick={handleReservationClick}
            onCreateSlot={onCreateSlot}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between py-6 border-b pl-8 pr-[33px]">
        <div className="flex-1 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const now = new Date()
              setSelectedDate(now)
              if (viewMode === "day" && isToday(now.toISOString().split("T")[0]) && dayViewRef.current) {
                const currentHour = now.getHours()
                const scrollPosition = currentHour * 80 - dayViewRef.current.clientHeight / 2 + 40
                dayViewRef.current.scrollTo({ top: Math.max(0, scrollPosition), behavior: "smooth" })
              }
            }}
            className={cn(
              "text-sm font-medium",
              isToday(selectedDate.toISOString().split("T")[0])
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground hover:bg-muted/80 border-0"
            )}
          >
            {t("controlCenter.calendar.today") || "Today"}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={prevPeriod}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[200px] text-center">{getPeriodLabel()}</h2>
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
              {t("controlCenter.calendar.year") || "Year"}
            </ToggleGroupItem>
            <ToggleGroupItem value="month" aria-label="Month view" className="px-3">
              {t("controlCenter.calendar.month") || "Month"}
            </ToggleGroupItem>
            <ToggleGroupItem value="week" aria-label="Week view" className="px-3">
              {t("controlCenter.calendar.week") || "Week"}
            </ToggleGroupItem>
            <ToggleGroupItem value="day" aria-label="Day view" className="px-3">
              {t("controlCenter.calendar.day") || "Day"}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      <div className="p-6 md:p-8 flex-1">{renderCalendarContent()}</div>
    </div>
  )
}
