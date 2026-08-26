"use client"

import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Reservation } from "@/app/types"
import { ReservationItem } from "./ReservationCalendarItem"
import {
  RANGE_HOLD_MS,
  TAP_MOVE_THRESHOLD,
  canDragCalendarRange,
  isHourInSelection,
  isKeyInRange,
  localDateKey,
  resolveCalendarPointerCommit,
  slotFromHours,
} from "./reservation-calendar-select"

export type { CalendarTimeSlot } from "./reservation-calendar-select"
export {
  defaultHourSlotOnDate,
  localDateKey,
  parseLocalDate,
  slotFromDayKeys,
  slotFromHours,
  slotFromMonthRange,
} from "./reservation-calendar-select"

type HourTarget = { date: Date; hour: number; dateKey: string }
type HourSelection = { dateKey: string; date: Date; startHour: number; endHour: number }
type KeySelection = { startKey: string; endKey: string }

type PointerGesture<T> = {
  pointerType: string
  pointerId: number
  startX: number
  startY: number
  target: T
  moved: boolean
  wasAlreadySelected: boolean
  dragArmed: boolean
  captureEl: HTMLElement | null
}

function pointerMoved(startX: number, startY: number, clientX: number, clientY: number) {
  return Math.hypot(clientX - startX, clientY - startY) >= TAP_MOVE_THRESHOLD
}

function isImmediateDragPointer(pointerType: string) {
  return pointerType === "mouse" || pointerType === "pen"
}

function capturePointer(el: HTMLElement | null, pointerId: number) {
  if (!el || !el.setPointerCapture) return
  try {
    el.setPointerCapture(pointerId)
  } catch {
    // Capture can fail if the pointer already ended.
  }
}

function useCalendarPointerGesture<Target, Selection>(config: {
  isSelected: (selection: Selection | null, target: Target) => boolean
  selectionFromTarget: (target: Target) => Selection
  selectionFromHover: (origin: Target, hover: Target) => Selection
  hoverFromPoint: (x: number, y: number) => Target | null
  onCreate?: (selection: Selection) => void
}) {
  const { isSelected, selectionFromTarget, selectionFromHover, hoverFromPoint, onCreate } = config
  const [selection, setSelection] = useState<Selection | null>(null)
  const [isGesturing, setIsGesturing] = useState(false)
  const selectionRef = useRef<Selection | null>(null)
  const gestureRef = useRef<PointerGesture<Target> | null>(null)
  const holdTimerRef = useRef<number | null>(null)
  selectionRef.current = selection

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current != null) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }, [])

  const applySelection = useCallback((next: Selection) => {
    selectionRef.current = next
    setSelection(next)
  }, [])

  const begin = useCallback(
    (target: Target, event: ReactPointerEvent) => {
      const alreadySelected = isSelected(selectionRef.current, target)
      const captureEl = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
      gestureRef.current = {
        pointerType: event.pointerType,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        target,
        moved: false,
        wasAlreadySelected: alreadySelected,
        dragArmed: isImmediateDragPointer(event.pointerType),
        captureEl,
      }
      if (isImmediateDragPointer(event.pointerType) && !alreadySelected) {
        applySelection(selectionFromTarget(target))
      }
      clearHoldTimer()
      if (!isImmediateDragPointer(event.pointerType)) {
        holdTimerRef.current = window.setTimeout(() => {
          const gesture = gestureRef.current
          if (!gesture || gesture.moved) return
          gesture.dragArmed = true
          applySelection(selectionFromTarget(gesture.target))
          capturePointer(gesture.captureEl, gesture.pointerId)
        }, RANGE_HOLD_MS)
      }
      setIsGesturing(true)
    },
    [applySelection, clearHoldTimer, isSelected, selectionFromTarget]
  )

  useEffect(() => {
    if (!isGesturing) return

    const onMove = (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (!gesture) return
      if (!gesture.moved && pointerMoved(gesture.startX, gesture.startY, event.clientX, event.clientY)) {
        gesture.moved = true
        clearHoldTimer()
        if (canDragCalendarRange(gesture)) {
          gesture.dragArmed = true
          capturePointer(gesture.captureEl, gesture.pointerId)
        }
      }
      if (!gesture.moved || !canDragCalendarRange(gesture)) return

      const hover = hoverFromPoint(event.clientX, event.clientY)
      if (hover == null) return
      applySelection(selectionFromHover(gesture.target, hover))
    }

    const onUp = () => {
      const gesture = gestureRef.current
      gestureRef.current = null
      clearHoldTimer()
      setIsGesturing(false)
      if (!gesture) return

      const action = resolveCalendarPointerCommit(gesture)
      if (action === "ignore") return

      if (action === "create") {
        const current = selectionRef.current
        if (current) onCreate?.(current)
        selectionRef.current = null
        setSelection(null)
        return
      }

      if (!gesture.moved) {
        applySelection(selectionFromTarget(gesture.target))
      }
    }

    const onTouchMove = (event: TouchEvent) => {
      const gesture = gestureRef.current
      if (!gesture || !canDragCalendarRange(gesture) || !gesture.moved) return
      event.preventDefault()
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    window.addEventListener("touchmove", onTouchMove, { passive: false })
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      window.removeEventListener("touchmove", onTouchMove)
      clearHoldTimer()
    }
  }, [
    applySelection,
    clearHoldTimer,
    hoverFromPoint,
    isGesturing,
    onCreate,
    selectionFromHover,
    selectionFromTarget,
  ])

  return { selection, begin, isSelected: selection }
}

export function useHourDragSelect(onCreateSlot?: (slot: { start: string; end: string }) => void) {
  const hoverFromPoint = useCallback((x: number, y: number): HourTarget | null => {
    const target = document.elementFromPoint(x, y)
    const cell = target?.closest("[data-hour-cell]") as HTMLElement | null
    if (!cell) return null
    const hour = Number(cell.dataset.hour)
    const dateKey = cell.dataset.day
    if (Number.isNaN(hour) || !dateKey) return null
    const [year, month, day] = dateKey.split("-").map(Number)
    return { date: new Date(year, (month || 1) - 1, day || 1, hour), hour, dateKey }
  }, [])

  const { selection, begin: beginGesture } = useCalendarPointerGesture<HourTarget, HourSelection>({
    isSelected: (current, target) => isHourInSelection(current, target.date, target.hour),
    selectionFromTarget: (target) => ({
      dateKey: target.dateKey,
      date: target.date,
      startHour: target.hour,
      endHour: target.hour,
    }),
    selectionFromHover: (origin, hover) => {
      if (origin.dateKey !== hover.dateKey) {
        return { dateKey: origin.dateKey, date: origin.date, startHour: origin.hour, endHour: origin.hour }
      }
      return { dateKey: origin.dateKey, date: origin.date, startHour: origin.hour, endHour: hover.hour }
    },
    hoverFromPoint,
    onCreate: (current) => onCreateSlot?.(slotFromHours(current.date, current.startHour, current.endHour)),
  })

  const begin = useCallback(
    (date: Date, hour: number, event: ReactPointerEvent) => {
      beginGesture({ date: new Date(date), hour, dateKey: localDateKey(date) }, event)
    },
    [beginGesture]
  )

  const isSelected = useCallback(
    (date: Date, hour: number) => isHourInSelection(selection, date, hour),
    [selection]
  )

  return { begin, isSelected }
}

export function useCalendarRangeDrag(
  cellSelector: string,
  keyAttr: string,
  onCommit?: (startKey: string, endKey: string) => void
) {
  const hoverFromPoint = useCallback(
    (x: number, y: number) => {
      const target = document.elementFromPoint(x, y)
      const cell = target?.closest(cellSelector) as HTMLElement | null
      return cell?.dataset[keyAttr] || null
    },
    [cellSelector, keyAttr]
  )

  const { selection, begin: beginGesture } = useCalendarPointerGesture<string, KeySelection>({
    isSelected: (current, key) => Boolean(current && isKeyInRange(current.startKey, current.endKey, key)),
    selectionFromTarget: (key) => ({ startKey: key, endKey: key }),
    selectionFromHover: (origin, hover) => ({ startKey: origin, endKey: hover }),
    hoverFromPoint,
    onCreate: (current) => onCommit?.(current.startKey, current.endKey),
  })

  const begin = useCallback(
    (key: string, event: ReactPointerEvent) => beginGesture(key, event),
    [beginGesture]
  )

  const isSelected = useCallback(
    (key: string) => Boolean(selection && isKeyInRange(selection.startKey, selection.endKey, key)),
    [selection]
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
  onBeginDrag?: (date: Date, hour: number, event: ReactPointerEvent) => void
}) {
  return (
    <div
      data-hour-cell
      data-hour={hour}
      data-day={localDateKey(date)}
      onPointerDown={(event) => {
        if (event.button !== 0 || !onBeginDrag) return
        const target = event.target as Element | null
        if (target?.closest && target.closest("[data-reservation-item]")) return
        if (isImmediateDragPointer(event.pointerType)) event.preventDefault()
        onBeginDrag(date, hour, event)
      }}
      className={cn(
        "h-20 border-b border-border p-2 relative group transition-colors select-none",
        onBeginDrag && "cursor-pointer",
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
