"use client"

import { cn } from "@/lib/utils"
import { CalendarBlock, Reservation } from "@/app/types"
import { reservationServiceColor } from "../reservation-helpers"
import { CalendarBlockItem, ReservationItem } from "./ReservationCalendarItem"
import { buildMonthCalendarDays, getMonthName } from "./reservation-calendar-utils"
import {
  CalendarTimeSlot,
  slotFromDayKeys,
  slotFromMonthRange,
  useCalendarRangeDrag,
  useHourDragSelect,
} from "./reservation-calendar-hour-select"
import { groupReservationsByService } from "./reservation-calendar-layout"
import {
  ReservationTimeColumn,
  reservationHourClassName,
  reservationHourLabel,
} from "./reservation-calendar-time-column"
import { localDateKey } from "./reservation-calendar-select"
import {
  calendarBlockAppliesToGroup,
  calendarBlockOverlapsMonth,
  calendarDayItems,
  type CalendarBlockSpan,
} from "../calendar-block-helpers"

export { ReservationWeekView } from "./reservation-calendar-week-view"

type ReservationsByDate = Record<string, Reservation[]>
type BlocksByDate = Record<string, CalendarBlockSpan[]>

type SharedViewProps = {
  reservationsByDate: ReservationsByDate
  blocksByDate: BlocksByDate
  isToday: (date: Date | string) => boolean
  onReservationClick: (reservation: Reservation) => void
  onBlockClick?: (block: CalendarBlock) => void
  onCreateSlot?: (slot: CalendarTimeSlot) => void
}

export function ReservationMonthView({
  selectedDate,
  weekdayLabels,
  reservationsByDate,
  blocksByDate,
  isToday,
  onReservationClick,
  onBlockClick,
  onCreateSlot,
}: SharedViewProps & { selectedDate: Date; weekdayLabels: string[] }) {
  const calendarDays = buildMonthCalendarDays(selectedDate.getFullYear(), selectedDate.getMonth())
  const { begin, isSelected } = useCalendarRangeDrag("[data-day-cell]", "day", (startKey, endKey) => {
    onCreateSlot?.(slotFromDayKeys(startKey, endKey))
  })

  return (
    <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
      {weekdayLabels.map((day) => (
        <div key={day} className="p-2 text-center text-sm font-medium bg-background sticky top-0 z-10">
          {day}
        </div>
      ))}
      {calendarDays.map(({ day, dateStr, isCurrentMonth: isCurrentMonthDay }, index) => {
        const dayReservations = reservationsByDate[dateStr] || []
        const dayBlocks = blocksByDate[dateStr] || []
        const dayItems = calendarDayItems(dayReservations, dayBlocks)
        const isCurrentDay = isToday(dateStr)
        const isDragSelected = isSelected(dateStr)

        return (
          <div
            key={`${dateStr}-${index}`}
            data-day-cell
            data-day={dateStr}
            onPointerDown={(event) => {
              if (event.button !== 0 || !onCreateSlot) return
              const target = event.target as Element | null
              if (target?.closest && target.closest("[data-reservation-item]")) return
              if (event.pointerType === "mouse") event.preventDefault()
              begin(dateStr, event)
            }}
            className={cn(
              "bg-background p-2 relative select-none min-h-[120px]",
              onCreateSlot && "cursor-pointer",
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
              {dayItems.map((item) =>
                item.kind === "block" ? (
                  <CalendarBlockItem
                    key={item.id}
                    block={item.block}
                    onClick={(block) => onBlockClick?.(block)}
                    showTime
                    displayStart={item.start_time}
                  />
                ) : (
                  <ReservationItem
                    key={item.id}
                    reservation={item.reservation}
                    onClick={onReservationClick}
                    showTime
                  />
                )
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ReservationDayView({
  selectedDate,
  reservationsByDate,
  blocksByDate,
  isToday,
  currentTime,
  timePosition,
  onReservationClick,
  onBlockClick,
  onCreateSlot,
}: SharedViewProps & {
  selectedDate: Date
  listGroupMode: "service" | "calendar"
  currentTime: Date
  timePosition: number
}) {
  const dateStr = localDateKey(selectedDate)
  const dayReservations = reservationsByDate[dateStr] || []
  const dayBlocks = blocksByDate[dateStr] || []
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const isCurrentDay = isToday(selectedDate)
  const { begin, isSelected } = useHourDragSelect(onCreateSlot)
  const serviceGroups = groupReservationsByService(dayReservations)
  const columns = serviceGroups.length > 0 ? serviceGroups : null

  const isHourPassed = (hour: number) => {
    if (!isCurrentDay) return false
    return hour < currentTime.getHours() || (hour === currentTime.getHours() && currentTime.getMinutes() > 0)
  }

  const isCurrentHourBlock = (hour: number) => isCurrentDay && hour === currentTime.getHours()

  return (
    <div className="bg-background rounded-lg">
      <div
        className="grid divide-x divide-border"
        style={{
          gridTemplateColumns: columns
            ? `100px repeat(${columns.length}, minmax(200px, 1fr))`
            : "100px minmax(200px, 1fr)",
        }}
      >
        {columns ? <div className="bg-muted/50 sticky top-0 left-0 z-10 border-b border-border h-10" /> : null}
        {columns?.map((group) => (
          <div
            key={group.key}
            className="bg-muted/50 sticky top-0 z-10 border-b border-border h-10 flex items-center justify-center gap-2 font-medium text-sm truncate px-2"
          >
            <span className={cn("h-2 w-2 shrink-0 rounded-full", reservationServiceColor(group.sample).swatch)} />
            <span className="truncate">{group.label}</span>
          </div>
        ))}
        <div className="bg-muted/50 sticky left-0 z-[2]">
          {hours.map((hour) => (
            <div key={hour} className={reservationHourClassName(isHourPassed(hour), isCurrentHourBlock(hour))}>
              {reservationHourLabel(hour)}
            </div>
          ))}
        </div>
        {(columns || [{ key: "all", reservations: dayReservations, catalogIds: [] }]).map((group) => (
          <div key={group.key} className="min-w-0">
            <ReservationTimeColumn
              date={selectedDate}
              reservations={group.reservations}
              blocks={dayBlocks.filter((span) =>
                calendarBlockAppliesToGroup(span.block, group.key, group.catalogIds)
              )}
              isCurrentDay={isCurrentDay}
              currentTime={currentTime}
              timePosition={timePosition}
              onReservationClick={onReservationClick}
              onBlockClick={onBlockClick}
              onBeginDrag={onCreateSlot ? begin : undefined}
              isSelected={isSelected}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ReservationYearView({
  selectedDate,
  reservations,
  blocks = [],
  onReservationClick,
  onBlockClick,
  onCreateSlot,
}: {
  selectedDate: Date
  reservations: Reservation[]
  blocks?: CalendarBlock[]
  onReservationClick: (reservation: Reservation) => void
  onBlockClick?: (block: CalendarBlock) => void
  onCreateSlot?: (slot: CalendarTimeSlot) => void
}) {
  const months = Array.from({ length: 12 }, (_, i) => i)
  const today = new Date()
  const year = selectedDate.getFullYear()
  const { begin, isSelected } = useCalendarRangeDrag("[data-month-cell]", "month", (startKey, endKey) => {
    onCreateSlot?.(slotFromMonthRange(year, Number(startKey), Number(endKey)))
  })

  return (
    <div className="grid grid-cols-4 gap-px bg-muted rounded-lg overflow-hidden">
      {months.map((month) => {
        const monthKey = String(month).padStart(2, "0")
        const monthReservations = reservations.filter((reservation) => {
          const resDate = new Date(reservation.start_time)
          return resDate.getMonth() === month && resDate.getFullYear() === year
        })
        const monthBlocks = blocks.filter((item) => calendarBlockOverlapsMonth(item, year, month))
        const monthItems = [
          ...monthReservations.map((reservation) => ({
            kind: "reservation" as const,
            id: reservation.id,
            start_time: reservation.start_time,
            reservation,
          })),
          ...monthBlocks.map((item) => ({
            kind: "block" as const,
            id: item.id,
            start_time: item.start_time,
            block: item,
          })),
        ].sort((a, b) => a.start_time.localeCompare(b.start_time))
        const visibleItems = monthItems.slice(0, 15)
        const remainingItems = monthItems.length - 15
        const isCurrentMonthHighlight = month === today.getMonth() && year === today.getFullYear()
        const isDragSelected = isSelected(monthKey)

        return (
          <div
            key={month}
            data-month-cell
            data-month={monthKey}
            onPointerDown={(event) => {
              if (event.button !== 0 || !onCreateSlot) return
              const target = event.target as Element | null
              if (target?.closest && target.closest("[data-reservation-item]")) return
              if (event.pointerType === "mouse") event.preventDefault()
              begin(monthKey, event)
            }}
            className={cn(
              "bg-background p-4 min-h-full flex flex-col select-none",
              onCreateSlot && "cursor-pointer",
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
              {visibleItems.length > 0 ? (
                <>
                  <div className="flex-1 space-y-2">
                    {visibleItems.map((item) =>
                      item.kind === "block" ? (
                        <CalendarBlockItem
                          key={item.id}
                          block={item.block}
                          onClick={(block) => onBlockClick?.(block)}
                          showDay
                        />
                      ) : (
                        <ReservationItem
                          key={item.id}
                          reservation={item.reservation}
                          onClick={onReservationClick}
                          showDay
                        />
                      )
                    )}
                  </div>
                  {remainingItems > 0 && (
                    <div className="text-xs text-muted-foreground text-center mt-3 py-1 bg-muted/50 rounded-md">
                      {`+${remainingItems} more`}
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
