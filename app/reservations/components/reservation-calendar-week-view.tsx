"use client"

import { cn } from "@/lib/utils"
import { CurrentTimeIndicator } from "@/app/control-center/components/CurrentTimeIndicator"
import { Reservation } from "@/app/types"
import { getWeekDates } from "./reservation-calendar-utils"
import { CalendarTimeSlot, HourCell, useHourDragSelect } from "./reservation-calendar-hour-select"

export function ReservationWeekView({
  selectedDate,
  reservationsByDate,
  isToday,
  currentTime,
  timePosition,
  onReservationClick,
  onCreateSlot,
}: {
  selectedDate: Date
  reservationsByDate: Record<string, Reservation[]>
  isToday: (date: Date | string) => boolean
  currentTime: Date
  timePosition: number
  onReservationClick: (reservation: Reservation) => void
  onCreateSlot?: (slot: CalendarTimeSlot) => void
}) {
  const weekDates = getWeekDates(selectedDate)
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const { begin, isSelected } = useHourDragSelect(onCreateSlot)

  return (
    <div className="bg-background rounded-lg overflow-auto h-[calc(100vh-280px)]">
      <div className="grid min-w-[720px]" style={{ gridTemplateColumns: "80px repeat(7, minmax(0, 1fr))" }}>
        <div className="bg-muted/50 sticky top-0 left-0 z-20 border-b border-border h-14" />
        {weekDates.map((date) => {
          const isCurrentDay = isToday(date)
          return (
            <div
              key={date.toISOString()}
              className={cn(
                "bg-background sticky top-0 z-10 border-b border-border h-14",
                isCurrentDay && "bg-accent/5"
              )}
            >
              <div className="flex flex-col items-center justify-center h-full">
                <div className="text-sm font-medium">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()]}
                </div>
                <div
                  className={cn(
                    "text-xs rounded-full w-6 h-6 flex items-center justify-center",
                    isCurrentDay && "bg-accent/10 text-accent-foreground"
                  )}
                >
                  {date.getDate()}
                </div>
              </div>
            </div>
          )
        })}

        <div className="bg-muted/50 sticky left-0 z-[2]">
          {hours.map((hour) => (
            <div key={hour} className="h-20 border-b border-border p-2 text-sm text-right pr-3 text-muted-foreground">
              {`${hour.toString().padStart(2, "0")}:00`}
            </div>
          ))}
        </div>

        {weekDates.map((date) => {
          const dateStr = date.toISOString().split("T")[0]
          const dayReservations = reservationsByDate[dateStr] || []
          const isCurrentDay = isToday(date)

          return (
            <div key={dateStr} className={cn("relative", isCurrentDay && "bg-accent/5")}>
              {hours.map((hour) => (
                <HourCell
                  key={hour}
                  date={date}
                  hour={hour}
                  isHourPassed={
                    isCurrentDay &&
                    (hour < currentTime.getHours() ||
                      (hour === currentTime.getHours() && currentTime.getMinutes() > 0))
                  }
                  isCurrentHourBlock={isCurrentDay && hour === currentTime.getHours()}
                  isDragSelected={isSelected(date, hour)}
                  reservations={dayReservations.filter((reservation) => {
                    return new Date(reservation.start_time).getHours() === hour
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
          )
        })}
      </div>
    </div>
  )
}
