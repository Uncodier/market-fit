"use client"

import { cn } from "@/lib/utils"
import { CalendarBlock, Reservation } from "@/app/types"
import { getWeekDates } from "./reservation-calendar-utils"
import { CalendarTimeSlot, useHourDragSelect } from "./reservation-calendar-hour-select"
import { ReservationTimeColumn, reservationHourLabel } from "./reservation-calendar-time-column"
import { localDateKey } from "./reservation-calendar-select"
import type { CalendarBlockSpan } from "../calendar-block-helpers"
import { useLocalization } from "@/app/context/LocalizationContext"

const WEEKDAY_KEYS = [
  "common.days.short.sun",
  "common.days.short.mon",
  "common.days.short.tue",
  "common.days.short.wed",
  "common.days.short.thu",
  "common.days.short.fri",
  "common.days.short.sat",
] as const

export function ReservationWeekView({
  selectedDate,
  reservationsByDate,
  blocksByDate,
  isToday,
  currentTime,
  timePosition,
  onReservationClick,
  onBlockClick,
  onCreateSlot,
}: {
  selectedDate: Date
  reservationsByDate: Record<string, Reservation[]>
  blocksByDate: Record<string, CalendarBlockSpan[]>
  isToday: (date: Date | string) => boolean
  currentTime: Date
  timePosition: number
  onReservationClick: (reservation: Reservation) => void
  onBlockClick?: (block: CalendarBlock) => void
  onCreateSlot?: (slot: CalendarTimeSlot) => void
}) {
  const { t } = useLocalization()
  const weekDates = getWeekDates(selectedDate)
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const { begin, isSelected } = useHourDragSelect(onCreateSlot)

  return (
    <div className="bg-background rounded-lg min-w-0">
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
                  {t(WEEKDAY_KEYS[date.getDay()]) || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()]}
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
              {reservationHourLabel(hour)}
            </div>
          ))}
        </div>

        {weekDates.map((date) => {
          const dateStr = localDateKey(date)
          const dayReservations = reservationsByDate[dateStr] || []
          const dayBlocks = blocksByDate[dateStr] || []
          const isCurrentDay = isToday(date)

          return (
            <div key={dateStr} className={cn("min-w-0", isCurrentDay && "bg-accent/5")}>
              <ReservationTimeColumn
                date={date}
                reservations={dayReservations}
                blocks={dayBlocks}
                isCurrentDay={isCurrentDay}
                currentTime={currentTime}
                timePosition={timePosition}
                onReservationClick={onReservationClick}
                onBlockClick={onBlockClick}
                onBeginDrag={onCreateSlot ? begin : undefined}
                isSelected={isSelected}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
