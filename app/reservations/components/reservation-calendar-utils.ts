export type CalendarViewMode = "year" | "month" | "week" | "day"

export function createNewDatePreservingDay(
  originalDate: Date,
  newYear: number,
  newMonth: number
) {
  const targetDay = originalDate.getDate()
  const lastDayOfNewMonth = new Date(newYear, newMonth + 1, 0).getDate()
  const day = Math.min(targetDay, lastDayOfNewMonth)

  const newDate = new Date(originalDate)
  newDate.setFullYear(newYear)
  newDate.setMonth(newMonth)
  newDate.setDate(day)
  return newDate
}

export function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

export function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export function getDaysInPreviousMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

export function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function getMonthName(month: number) {
  return new Date(0, month).toLocaleString("default", { month: "long" })
}

export function getWeekDates(date: Date) {
  const result = []
  const firstDayOfWeek = new Date(date)
  firstDayOfWeek.setDate(date.getDate() - date.getDay())

  for (let i = 0; i < 7; i++) {
    const day = new Date(firstDayOfWeek)
    day.setDate(firstDayOfWeek.getDate() + i)
    result.push(day)
  }
  return result
}

export function buildMonthCalendarDays(year: number, month: number) {
  const daysInMonth = getDaysInMonth(year, month)
  const firstDayOfMonth = getFirstDayOfMonth(year, month)
  const calendarDays: { day: number; dateStr: string; isCurrentMonth: boolean }[] = []

  const daysInPreviousMonth = getDaysInPreviousMonth(year, month)
  for (let i = 0; i < firstDayOfMonth; i++) {
    const day = daysInPreviousMonth - firstDayOfMonth + i + 1
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    calendarDays.push({ day, dateStr: formatDate(prevYear, prevMonth, day), isCurrentMonth: false })
  }

  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({ day, dateStr: formatDate(year, month, day), isCurrentMonth: true })
  }

  const totalDaysShown = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7
  const daysFromNextMonth = totalDaysShown - (firstDayOfMonth + daysInMonth)
  for (let day = 1; day <= daysFromNextMonth; day++) {
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    calendarDays.push({ day, dateStr: formatDate(nextYear, nextMonth, day), isCurrentMonth: false })
  }

  return calendarDays
}
