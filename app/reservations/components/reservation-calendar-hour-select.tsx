"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Reservation } from "@/app/types"
import { ReservationItem } from "./ReservationCalendarItem"

export type CalendarTimeSlot = { start: string; end: string }

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function parseLocalDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

export function defaultHourSlotOnDate(date: Date): CalendarTimeSlot {
  const start = new Date(date)
  const now = new Date()
  let hour = 9
  if (
    start.getFullYear() === now.getFullYear() &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate() &&
    now.getHours() >= 9
  ) {
    hour = Math.min(22, now.getHours() + 1)
  }
  start.setHours(hour, 0, 0, 0)
  const end = new Date(start)
  end.setHours(hour + 1, 0, 0, 0)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function slotFromDayKeys(startKey: string, endKey: string): CalendarTimeSlot {
  const firstKey = startKey <= endKey ? startKey : endKey
  const lastKey = startKey <= endKey ? endKey : startKey
  const startSlot = defaultHourSlotOnDate(parseLocalDate(firstKey))
  if (firstKey === lastKey) return startSlot
  const endSlot = defaultHourSlotOnDate(parseLocalDate(lastKey))
  return { start: startSlot.start, end: endSlot.end }
}

export function slotFromMonthRange(year: number, monthA: number, monthB: number): CalendarTimeSlot {
  const from = Math.min(monthA, monthB)
  const to = Math.max(monthA, monthB)
  const startSlot = defaultHourSlotOnDate(new Date(year, from, 1))
  if (from === to) return startSlot
  const endSlot = defaultHourSlotOnDate(new Date(year, to, 1))
  return { start: startSlot.start, end: endSlot.end }
}

export function slotFromHours(date: Date, hourA: number, hourB: number): CalendarTimeSlot {
  const startHour = Math.min(hourA, hourB)
  const endHour = Math.max(hourA, hourB) + 1
  const start = new Date(date)
  start.setHours(startHour, 0, 0, 0)
  const end = new Date(date)
  if (endHour >= 24) {
    end.setDate(end.getDate() + 1)
    end.setHours(0, 0, 0, 0)
  } else {
    end.setHours(endHour, 0, 0, 0)
  }
  return { start: start.toISOString(), end: end.toISOString() }
}

type DragState = {
  dateKey: string
  date: Date
  startHour: number
  endHour: number
}

export function useHourDragSelect(onCreateSlot?: (slot: CalendarTimeSlot) => void) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  dragRef.current = drag

  const begin = useCallback((date: Date, hour: number) => {
    const next = { dateKey: localDateKey(date), date: new Date(date), startHour: hour, endHour: hour }
    dragRef.current = next
    setDrag(next)
  }, [])

  const update = useCallback((dateKey: string, hour: number) => {
    setDrag((current) => {
      if (!current || current.dateKey !== dateKey) return current
      if (current.endHour === hour) return current
      const next = { ...current, endHour: hour }
      dragRef.current = next
      return next
    })
  }, [])

  const finish = useCallback(() => {
    const current = dragRef.current
    if (!current) return
    dragRef.current = null
    setDrag(null)
    onCreateSlot?.(slotFromHours(current.date, current.startHour, current.endHour))
  }, [onCreateSlot])

  useEffect(() => {
    if (!drag) return

    const onMove = (event: PointerEvent) => {
      const target = document.elementFromPoint(event.clientX, event.clientY)
      const cell = target?.closest("[data-hour-cell]") as HTMLElement | null
      if (!cell) return
      const hour = Number(cell.dataset.hour)
      const key = cell.dataset.day
      if (Number.isNaN(hour) || !key) return
      update(key, hour)
    }

    const onUp = () => finish()

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [drag, finish, update])

  const isSelected = useCallback(
    (date: Date, hour: number) => {
      if (!drag || drag.dateKey !== localDateKey(date)) return false
      const from = Math.min(drag.startHour, drag.endHour)
      const to = Math.max(drag.startHour, drag.endHour)
      return hour >= from && hour <= to
    },
    [drag]
  )

  return { drag, begin, isSelected }
}

export function useCalendarRangeDrag(
  cellSelector: string,
  keyAttr: string,
  onCommit?: (startKey: string, endKey: string) => void
) {
  const [drag, setDrag] = useState<{ startKey: string; endKey: string } | null>(null)
  const dragRef = useRef<{ startKey: string; endKey: string } | null>(null)
  dragRef.current = drag

  const begin = useCallback((key: string) => {
    const next = { startKey: key, endKey: key }
    dragRef.current = next
    setDrag(next)
  }, [])

  const update = useCallback((key: string) => {
    setDrag((current) => {
      if (!current || current.endKey === key) return current
      const next = { ...current, endKey: key }
      dragRef.current = next
      return next
    })
  }, [])

  const finish = useCallback(() => {
    const current = dragRef.current
    if (!current) return
    dragRef.current = null
    setDrag(null)
    onCommit?.(current.startKey, current.endKey)
  }, [onCommit])

  useEffect(() => {
    if (!drag) return

    const onMove = (event: PointerEvent) => {
      const target = document.elementFromPoint(event.clientX, event.clientY)
      const cell = target?.closest(cellSelector) as HTMLElement | null
      const key = cell?.dataset[keyAttr]
      if (!key) return
      update(key)
    }

    const onUp = () => finish()
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [cellSelector, drag, finish, keyAttr, update])

  const isSelected = useCallback(
    (key: string) => {
      if (!drag) return false
      const from = drag.startKey <= drag.endKey ? drag.startKey : drag.endKey
      const to = drag.startKey <= drag.endKey ? drag.endKey : drag.startKey
      return key >= from && key <= to
    },
    [drag]
  )

  return { begin, isSelected }
}

export function HourCell({
  date,
  hour,
  isHourPassed,
  isCurrentHourBlock,
  isDragSelected,
  reservations,
  onReservationClick,
  onBeginDrag,
}: {
  date: Date
  hour: number
  isHourPassed: boolean
  isCurrentHourBlock: boolean
  isDragSelected: boolean
  reservations: Reservation[]
  onReservationClick: (reservation: Reservation) => void
  onBeginDrag?: (date: Date, hour: number) => void
}) {
  return (
    <div
      data-hour-cell
      data-hour={hour}
      data-day={localDateKey(date)}
      onPointerDown={(event) => {
        if (event.button !== 0 || !onBeginDrag) return
        if ((event.target as HTMLElement).closest("[data-reservation-item]")) return
        event.preventDefault()
        onBeginDrag(date, hour)
      }}
      className={cn(
        "h-20 border-b border-border p-2 relative group transition-colors select-none",
        onBeginDrag && "cursor-crosshair",
        !isHourPassed && !isDragSelected && "hover:bg-accent/5",
        isCurrentHourBlock && !isDragSelected && "bg-accent/20 dark:bg-accent/30",
        isDragSelected && "bg-primary/15"
      )}
    >
      {reservations.map((reservation) => (
        <ReservationItem
          key={reservation.id}
          reservation={reservation}
          onClick={onReservationClick}
          showTime
        />
      ))}
    </div>
  )
}
