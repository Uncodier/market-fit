"use client"

import { PointerEvent as ReactPointerEvent } from "react"
import { cn } from "@/lib/utils"
import { CurrentTimeIndicator } from "@/app/control-center/components/CurrentTimeIndicator"
import { CalendarBlock, Reservation } from "@/app/types"
import { CalendarBlockItem, ReservationItem } from "./ReservationCalendarItem"
import { HourCell } from "./reservation-calendar-hour-select"
import { layoutReservationLanes } from "./reservation-calendar-layout"
import type { CalendarBlockSpan } from "../calendar-block-helpers"

const HOURS = Array.from({ length: 24 }, (_, i) => i)

type TimedCalendarEvent =
  | {
      id: string
      start_time: string
      end_time: string
      kind: "reservation"
      reservation: Reservation
    }
  | {
      id: string
      start_time: string
      end_time: string
      kind: "block"
      block: CalendarBlock
    }

export function ReservationTimeColumn({
  date,
  reservations,
  blocks = [],
  isCurrentDay,
  currentTime,
  timePosition,
  onReservationClick,
  onBlockClick,
  onBeginDrag,
  isSelected,
}: {
  date: Date
  reservations: Reservation[]
  blocks?: CalendarBlockSpan[]
  isCurrentDay: boolean
  currentTime: Date
  timePosition: number
  onReservationClick: (reservation: Reservation) => void
  onBlockClick?: (block: CalendarBlock) => void
  onBeginDrag?: (date: Date, hour: number, event: ReactPointerEvent) => void
  isSelected: (date: Date, hour: number) => boolean
}) {
  const timedItems: TimedCalendarEvent[] = [
    ...reservations.map((reservation) => ({
      id: reservation.id,
      start_time: reservation.start_time,
      end_time: reservation.end_time,
      kind: "reservation" as const,
      reservation,
    })),
    ...blocks.map((span) => ({
      id: `block:${span.block.id}`,
      start_time: span.start_time,
      end_time: span.end_time,
      kind: "block" as const,
      block: span.block,
    })),
  ]
  const laidOut = layoutReservationLanes(timedItems)

  return (
    <div className="relative">
      {isCurrentDay && (
        <div
          className="absolute left-0 right-0 top-0 bg-muted/30 dark:bg-muted/50 pointer-events-none z-0"
          style={{ height: `${timePosition}px` }}
        />
      )}
      {HOURS.map((hour) => (
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
          onBeginDrag={onBeginDrag}
        />
      ))}
      <div className="absolute inset-0 z-[1] pointer-events-none">
        {laidOut.map((item) => {
          const event = item.reservation
          return (
            <div
              key={event.id}
              className="absolute pointer-events-auto px-0.5"
              style={{
                top: item.top,
                height: item.height,
                left: `${item.leftPct}%`,
                width: `${item.widthPct}%`,
                zIndex: item.zIndex,
              }}
            >
              {event.kind === "block" ? (
                <CalendarBlockItem
                  block={event.block}
                  onClick={(block) => onBlockClick?.(block)}
                  showTime
                  compact
                  displayStart={event.start_time}
                />
              ) : (
                <ReservationItem
                  reservation={event.reservation}
                  onClick={onReservationClick}
                  showTime
                  compact
                />
              )}
            </div>
          )
        })}
      </div>
      {isCurrentDay && (
        <CurrentTimeIndicator
          timePosition={timePosition}
          currentTime={currentTime}
          showLabel={false}
        />
      )}
    </div>
  )
}

export function reservationHourLabel(hour: number) {
  return `${hour.toString().padStart(2, "0")}:00`
}

export function reservationHourClassName(isHourPassed: boolean, isCurrentHourBlock: boolean) {
  return cn(
    "h-20 border-b border-border p-2 text-sm text-right pr-4",
    isHourPassed && "text-muted-foreground",
    isCurrentHourBlock && "text-accent-foreground font-medium"
  )
}
