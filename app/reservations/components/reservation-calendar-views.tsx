"use client"

import { RefObject } from "react"
import { cn } from "@/lib/utils"
import { CurrentTimeIndicator } from "@/app/control-center/components/CurrentTimeIndicator"
import { Reservation } from "@/app/types"
import { ReservationItem } from "./ReservationCalendarItem"
import { buildMonthCalendarDays, getMonthName } from "./reservation-calendar-utils"
import {
  CalendarTimeSlot,
  HourCell,
  slotFromDayKeys,
  slotFromMonthRange,
  useCalendarRangeDrag,
  useHourDragSelect,
} from "./reservation-calendar-hour-select"

export { ReservationWeekView } from "./reservation-calendar-week-view"

type ReservationsByDate = Record<string, Reservation[]>

type SharedViewProps = {
  reservationsByDate: ReservationsByDate
  isToday: (date: Date | string) => boolean
  onReservationClick: (reservation: Reservation) => void
  onCreateSlot?: (slot: CalendarTimeSlot) => void
}

export function ReservationMonthView({
  selectedDate,
  weekdayLabels,
  reservationsByDate,
  isToday,
  onReservationClick,
  onCreateSlot,
}: SharedViewProps & { selectedDate: Date; weekdayLabels: string[] }) {
  const calendarDays = buildMonthCalendarDays(selectedDate.getFullYear(), selectedDate.getMonth())
  const { begin, isSelected } = useCalendarRangeDrag("[data-day-cell]", "day", (startKey, endKey) => {
    onCreateSlot?.(slotFromDayKeys(startKey, endKey))
  })

  return (
    <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden h-[calc(100vh-280px)]">
      {weekdayLabels.map((day) => (
        <div key={day} className="p-2 text-center text-sm font-medium bg-background sticky top-0 z-10">
          {day}
        </div>
      ))}
      {calendarDays.map(({ day, dateStr, isCurrentMonth: isCurrentMonthDay }, index) => {
        const dayReservations = reservationsByDate[dateStr] || []
        const isCurrentDay = isToday(dateStr)
        const isDragSelected = isSelected(dateStr)

        return (
          <div
            key={`${dateStr}-${index}`}
            data-day-cell
            data-day={dateStr}
            onPointerDown={(event) => {
              if (event.button !== 0 || !onCreateSlot) return
              if ((event.target as HTMLElement).closest("[data-reservation-item]")) return
              event.preventDefault()
              begin(dateStr)
            }}
            className={cn(
              "bg-background p-2 relative select-none",
              onCreateSlot && "cursor-crosshair",
              !isCurrentMonthDay && "text-muted-foreground/50",
              isCurrentDay && !isDragSelected && "bg-accent/5",
              isDragSelected && "bg-primary/15"
            )}
          >
            <div
              className={cn(
                "text-sm font-medium mb-2 text-center rounded-full w-7 h-7 mx-auto flex items-center justify-center",
                !isCurrentMonthDay && "text-muted-foreground/50",
                isCurrentDay && "bg-accent/10 text-accent-foreground"
              )}
            >
              {day}
            </div>
            <div className="space-y-1">
              {dayReservations.map((reservation) => (
                <ReservationItem
                  key={reservation.id}
                  reservation={reservation}
                  onClick={onReservationClick}
                  showTime
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ReservationDayView({
  selectedDate,
  listGroupMode,
  dayViewRef,
  reservationsByDate,
  isToday,
  currentTime,
  timePosition,
  onReservationClick,
  onCreateSlot,
}: SharedViewProps & {
  selectedDate: Date
  listGroupMode: "service" | "calendar"
  dayViewRef: RefObject<HTMLDivElement | null>
  currentTime: Date
  timePosition: number
}) {
  const dateStr = selectedDate.toISOString().split("T")[0]
  const dayReservations = reservationsByDate[dateStr] || []
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const isCurrentDay = isToday(selectedDate)
  const { begin, isSelected } = useHourDragSelect(onCreateSlot)

  const isHourPassed = (hour: number) => {
    if (!isCurrentDay) return false
    return hour < currentTime.getHours() || (hour === currentTime.getHours() && currentTime.getMinutes() > 0)
  }

  const isCurrentHourBlock = (hour: number) => isCurrentDay && hour === currentTime.getHours()

  const services =
    listGroupMode === "service"
      ? Array.from(new Set(dayReservations.map((r) => r.catalog_item?.name || "Unknown Service")))
      : []

  if (listGroupMode === "service" && services.length > 0) {

    return (
      <div
        ref={dayViewRef}
        className="bg-background rounded-lg overflow-auto h-[calc(100vh-280px)] scroll-smooth"
      >
        <div
          className="grid divide-x divide-border"
          style={{ gridTemplateColumns: `100px repeat(${services.length}, minmax(200px, 1fr))` }}
        >
          <div className="bg-muted/50 sticky top-0 left-0 z-10 border-b border-border h-10" />
          {services.map((serviceName) => (
            <div
              key={serviceName}
              className="bg-muted/50 sticky top-0 z-10 border-b border-border h-10 flex items-center justify-center font-medium text-sm truncate px-2"
            >
              {serviceName}
            </div>
          ))}
          <div className="bg-muted/50 sticky left-0 z-[2] mt-10" style={{ gridRow: "2 / span 24", gridColumn: "1" }}>
            {hours.map((hour) => (
              <div
                key={hour}
                className={cn(
                  "h-20 border-b border-border p-2 text-sm text-right pr-4",
                  isHourPassed(hour) && "text-muted-foreground",
                  isCurrentHourBlock(hour) && "text-accent-foreground font-medium"
                )}
              >
                {`${hour.toString().padStart(2, "0")}:00`}
              </div>
            ))}
          </div>
          {services.map((serviceName, colIndex) => (
            <div key={serviceName} className="relative" style={{ gridRow: "2 / span 24", gridColumn: colIndex + 2 }}>
              {isCurrentDay && (
                <div
                  className="absolute left-0 right-0 top-0 bg-muted/30 dark:bg-muted/50 pointer-events-none z-0"
                  style={{ height: `${timePosition}px` }}
                />
              )}
              {hours.map((hour) => (
                <HourCell
                  key={hour}
                  date={selectedDate}
                  hour={hour}
                  isHourPassed={isHourPassed(hour)}
                  isCurrentHourBlock={isCurrentHourBlock(hour)}
                  isDragSelected={isSelected(selectedDate, hour)}
                  reservations={dayReservations.filter((r) => {
                    const resDate = new Date(r.start_time)
                    return resDate.getHours() === hour && (r.catalog_item?.name || "Unknown Service") === serviceName
                  })}
                  onReservationClick={onReservationClick}
                  onBeginDrag={onCreateSlot ? begin : undefined}
                />
              ))}
              {isCurrentDay && (
                <CurrentTimeIndicator
                  timePosition={timePosition}
                  currentTime={currentTime}
                  showLabel={false}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const reservationsByHour = hours.reduce((acc, hour) => {
    acc[hour] = dayReservations.filter((reservation) => new Date(reservation.start_time).getHours() === hour)
    return acc
  }, {} as Record<number, Reservation[]>)

  return (
    <div
      ref={dayViewRef}
      className="bg-background rounded-lg overflow-auto h-[calc(100vh-280px)] scroll-smooth"
    >
      <div className="grid grid-cols-[100px_1fr] divide-x divide-border">
        <div className="bg-muted/50 sticky left-0 z-[2]">
          {hours.map((hour) => (
            <div
              key={hour}
              className={cn(
                "h-20 border-b border-border p-2 text-sm text-right pr-4",
                isHourPassed(hour) && "text-muted-foreground",
                isCurrentHourBlock(hour) && "text-accent-foreground font-medium"
              )}
            >
              {`${hour.toString().padStart(2, "0")}:00`}
            </div>
          ))}
        </div>
        <div className="relative min-w-[200px]">
          {isCurrentDay && (
            <div
              className="absolute left-0 right-0 top-0 bg-muted/30 dark:bg-muted/50 pointer-events-none z-0"
              style={{ height: `${timePosition}px` }}
            />
          )}
          {hours.map((hour) => (
            <HourCell
              key={hour}
              date={selectedDate}
              hour={hour}
              isHourPassed={isHourPassed(hour)}
              isCurrentHourBlock={isCurrentHourBlock(hour)}
              isDragSelected={isSelected(selectedDate, hour)}
              reservations={reservationsByHour[hour] || []}
              onReservationClick={onReservationClick}
              onBeginDrag={onCreateSlot ? begin : undefined}
            />
          ))}
          {isCurrentDay && (
            <CurrentTimeIndicator
              timePosition={timePosition}
              currentTime={currentTime}
              showLabel={false}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export function ReservationYearView({
  selectedDate,
  reservations,
  onReservationClick,
  onCreateSlot,
}: {
  selectedDate: Date
  reservations: Reservation[]
  onReservationClick: (reservation: Reservation) => void
  onCreateSlot?: (slot: CalendarTimeSlot) => void
}) {
  const months = Array.from({ length: 12 }, (_, i) => i)
  const today = new Date()
  const year = selectedDate.getFullYear()
  const { begin, isSelected } = useCalendarRangeDrag("[data-month-cell]", "month", (startKey, endKey) => {
    onCreateSlot?.(slotFromMonthRange(year, Number(startKey), Number(endKey)))
  })

  return (
    <div className="grid grid-cols-4 gap-px bg-muted rounded-lg overflow-hidden h-[calc(100vh-280px)]">
      {months.map((month) => {
        const monthKey = String(month).padStart(2, "0")
        const monthReservations = reservations.filter((reservation) => {
          const resDate = new Date(reservation.start_time)
          return resDate.getMonth() === month && resDate.getFullYear() === year
        })
        const visibleReservations = monthReservations.slice(0, 15)
        const remainingReservations = monthReservations.length - 15
        const isCurrentMonthHighlight = month === today.getMonth() && year === today.getFullYear()
        const isDragSelected = isSelected(monthKey)

        return (
          <div
            key={month}
            data-month-cell
            data-month={monthKey}
            onPointerDown={(event) => {
              if (event.button !== 0 || !onCreateSlot) return
              if ((event.target as HTMLElement).closest("[data-reservation-item]")) return
              event.preventDefault()
              begin(monthKey)
            }}
            className={cn(
              "bg-background p-4 min-h-full flex flex-col select-none",
              onCreateSlot && "cursor-crosshair",
              isCurrentMonthHighlight && !isDragSelected && "bg-accent/5",
              isDragSelected && "bg-primary/15"
            )}
          >
            <h3
              className={cn(
                "font-medium text-sm mb-3 text-center rounded-full py-1",
                isCurrentMonthHighlight && "text-accent-foreground"
              )}
            >
              {getMonthName(month)}
            </h3>
            <div className="flex-1 flex flex-col">
              {visibleReservations.length > 0 ? (
                <>
                  <div className="flex-1 space-y-2">
                    {visibleReservations.map((reservation) => (
                      <ReservationItem
                        key={reservation.id}
                        reservation={reservation}
                        onClick={onReservationClick}
                        showDay
                      />
                    ))}
                  </div>
                  {remainingReservations > 0 && (
                    <div className="text-xs text-muted-foreground text-center mt-3 py-1 bg-muted/50 rounded-md">
                      {`+${remainingReservations} more`}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-xs text-muted-foreground text-center py-8 px-4 w-full">
                    No reservations
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
