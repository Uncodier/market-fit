import {
  addDays, addMonths, addWeeks, endOfDay, endOfMonth, endOfWeek, endOfYear,
  isSameYear, startOfDay, startOfMonth, startOfWeek, subDays,
} from "date-fns"
import type { Locale } from "date-fns"
import type { DateEvent, DatePickerMode } from "./date-picker-types"
import { getDateRangeError } from "./date-picker-range"
import { resolveDateRangePreset, type DateRangePreset } from "@/lib/dates/date-range-presets"

type Translate = (key: string) => string

export function getEventRange(event: DateEvent, locale: Locale, now = new Date()) {
  const start = startOfDay(event.value)
  let end = event.endDate
  if (!end) {
    switch (event.type) {
      case "day": end = endOfDay(start); break
      case "week": end = endOfWeek(start, { locale }); break
      case "month": end = endOfMonth(start); break
      case "year": end = isSameYear(start, now) ? now : endOfYear(start); break
      default: end = now
    }
  }
  return { start, end: endOfDay(end) }
}

export function boundDateEvents(events: DateEvent[], locale: Locale, maxRangeDays?: number): DateEvent[] {
  return events.map((event) => {
    if (event.disabled) return event
    const { start, end } = getEventRange(event, locale)
    const error = getDateRangeError(start, end, maxRangeDays)
    return error ? { ...event, disabled: true, disabledReason: error } : event
  })
}

export function getDefaultDateEvents(
  mode: DatePickerMode, t: Translate, locale: Locale, maxRangeDays?: number, now = new Date(),
): DateEvent[] {
  const today = startOfDay(now)
  const endToday = endOfDay(today)
  const weekOpts = { locale }
  const event = (
    id: string, value: Date, type: DateEvent['type'], period: DateEvent['period'], endDate?: Date,
  ): DateEvent => ({ id, label: t(`datePicker.${id}`), value, type, period, endDate })
  const common = [event("today", today, "day", "current", endToday)]
  const thisWeek = event("thisWeek", startOfWeek(today, weekOpts), "week", "current")
  const thisMonth = event("thisMonth", startOfMonth(today), "month", "current")
  const tomorrow = event("tomorrow", addDays(today, 1), "day", "future")

  if (mode === 'range' || mode === 'report') {
    const relativeEvent = (id: DateRangePreset, type: DateEvent['type'], period: DateEvent['period']) => {
      const { startDate, endDate } = resolveDateRangePreset(id, now, locale)
      return event(id, startDate, type, period, endDate)
    }
    const presets = [
      relativeEvent("today", "day", "current"),
      ...(mode === 'report' ? [relativeEvent("yesterday", "day", "past")] : []),
      relativeEvent("last7Days", "custom", "past"),
      relativeEvent("last30Days", "custom", "past"),
      { ...relativeEvent("last90Days", "custom", "past"), label: "Last 90 days" },
      ...(mode === 'range' ? [relativeEvent("thisWeek", "week", "current")] : []),
      relativeEvent("thisMonth", "month", "current"),
      relativeEvent("lastMonth", "month", "past"),
      relativeEvent("thisQuarter", "custom", "current"),
      relativeEvent("yearToDate", "year", "current"),
      ...(mode === 'range' ? [
        relativeEvent("lastYear", "year", "past"),
        {
          ...event("allTime", today, "custom", "past", endToday),
          disabled: true,
          disabledReason: maxRangeDays !== undefined
            ? `All time is not available for this report. Select up to ${maxRangeDays} days.`
            : "All time is unavailable because the earliest available date is unknown. Select a custom range.",
        },
      ] : []),
    ]
    return boundDateEvents(presets, locale, maxRangeDays)
  }

  switch (mode) {
    case 'task': return [
      ...common, tomorrow,
      event("nextWeek", addWeeks(today, 1), "week", "future"),
      event("nextMonth", addMonths(today, 1), "month", "future"),
    ]
    case 'calendar': return [
      ...common, tomorrow, thisWeek,
      event("nextWeek", startOfWeek(addWeeks(today, 1), weekOpts), "week", "future"),
      thisMonth, event("nextMonth", startOfMonth(addMonths(today, 1)), "month", "future"),
    ]
    default: return [
      ...common, tomorrow, event("yesterday", subDays(today, 1), "day", "past"), thisWeek, thisMonth,
    ]
  }
}