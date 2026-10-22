import type { CalendarViewMode } from "./components/reservation-calendar-utils"
import { localDateKey, parseLocalDate } from "./components/reservation-calendar-select"

export interface ReservationReadWindow { start: string; end: string }
const MAX_WINDOW_MS = 366 * 24 * 60 * 60 * 1000
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/

export function validateReadWindow(input: ReservationReadWindow): ReservationReadWindow {
  if (!input || typeof input.start !== "string" || typeof input.end !== "string") {
    throw new Error("A start and end timestamp are required.")
  }
  const parse = (value: string) => {
    if (!ISO_INSTANT.test(value)) throw new Error("Use ISO timestamps with a timezone.")
    const time = Date.parse(value)
    const [year, month, day] = value.slice(0, 10).split("-").map(Number)
    const [hour, minute, second] = value.slice(11, 19).split(":").map(Number)
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
    if (!Number.isFinite(time) || month < 1 || month > 12 || day < 1 || day > days || hour > 23 || minute > 59 || second > 59) {
      throw new Error("Invalid date window.")
    }
    return time
  }
  const start = parse(input.start), end = parse(input.end)
  if (end <= start || end - start > MAX_WINDOW_MS) {
    throw new Error("Choose an ordered date window of at most 366 days.")
  }
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() }
}

export function calendarSelectedDate(value: string | null, now = new Date()) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return now
  const date = parseLocalDate(value)
  return localDateKey(date) === value ? date : now
}

export function calendarReadWindow(date: Date, mode: CalendarViewMode): ReservationReadWindow {
  const year = date.getFullYear(), month = date.getMonth()
  let start = new Date(year, month, date.getDate())
  let end = new Date(year, month, date.getDate() + 1)
  if (mode === "year") {
    start = new Date(year, 0, 1); end = new Date(year + 1, 0, 1)
  } else if (mode === "month") {
    start = new Date(year, month, 1)
    start.setDate(1 - start.getDay())
    end = new Date(year, month + 1, 1)
    if (end.getDay()) end.setDate(end.getDate() + 7 - end.getDay())
  } else if (mode === "week") {
    start.setDate(start.getDate() - start.getDay())
    end = new Date(start); end.setDate(start.getDate() + 7)
  }
  return { start: start.toISOString(), end: end.toISOString() }
}

export function listReadWindow(date: Date): ReservationReadWindow {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1).toISOString(),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 1).toISOString(),
  }
}

export function overlapsReadWindow(start: string, end: string | null | undefined, window: ReservationReadWindow) {
  // A missing reservation end is open-ended, not an invisible zero-length event.
  return Date.parse(start) < Date.parse(window.end) && (!end || Date.parse(end) > Date.parse(window.start))
}