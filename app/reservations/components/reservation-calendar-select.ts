export type CalendarTimeSlot = { start: string; end: string }

export type CalendarPointerAction = "create" | "select" | "ignore"

export const TAP_MOVE_THRESHOLD = 10
export const RANGE_HOLD_MS = 180

export function canDragCalendarRange(input: {
  pointerType: string
  dragArmed: boolean
  wasAlreadySelected?: boolean
}) {
  return input.pointerType === "mouse" || input.pointerType === "pen" || input.dragArmed
}

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

export function isHourInSelection(
  selection: { dateKey: string; startHour: number; endHour: number } | null,
  date: Date,
  hour: number
) {
  if (!selection || selection.dateKey !== localDateKey(date)) return false
  const from = Math.min(selection.startHour, selection.endHour)
  const to = Math.max(selection.startHour, selection.endHour)
  return hour >= from && hour <= to
}

export function isKeyInRange(startKey: string, endKey: string, key: string) {
  const from = startKey <= endKey ? startKey : endKey
  const to = startKey <= endKey ? endKey : startKey
  return key >= from && key <= to
}

export function resolveCalendarPointerCommit(input: {
  pointerType: string
  moved: boolean
  wasAlreadySelected: boolean
  dragArmed: boolean
}): CalendarPointerAction {
  if (input.moved && !canDragCalendarRange(input)) return "ignore"
  if (input.wasAlreadySelected && !input.moved) return "create"
  return "select"
}
