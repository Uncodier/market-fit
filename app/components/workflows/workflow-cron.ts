export const DEFAULT_CRON = "0 * * * *"
export const DEFAULT_CRON_HOUR = 9
export const DEFAULT_CRON_WEEKDAY = 1

export type CronPreset =
  | "hourly"
  | "every_2h"
  | "every_3h"
  | "every_4h"
  | "every_6h"
  | "every_8h"
  | "every_12h"
  | "daily"
  | "weekdays"
  | "weekly"
  | "custom"

export interface CronSchedule {
  preset: CronPreset
  hour: number
  weekday: number
  expression: string
}

const HOUR_INTERVALS: Record<number, Exclude<CronPreset, "hourly" | "daily" | "weekdays" | "weekly" | "custom">> = {
  2: "every_2h",
  3: "every_3h",
  4: "every_4h",
  6: "every_6h",
  8: "every_8h",
  12: "every_12h",
}

export const CRON_PRESET_OPTIONS: readonly { value: CronPreset; label: string }[] = [
  { value: "hourly", label: "Every hour" },
  { value: "every_2h", label: "Every 2 hours" },
  { value: "every_3h", label: "Every 3 hours" },
  { value: "every_4h", label: "Every 4 hours" },
  { value: "every_6h", label: "Every 6 hours" },
  { value: "every_8h", label: "Every 8 hours" },
  { value: "every_12h", label: "Every 12 hours" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
  { value: "custom", label: "Custom" },
]

export const CRON_HOUR_OPTIONS: readonly { value: string; label: string }[] = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, "0")}:00`,
}))

export const CRON_WEEKDAY_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
]

const CRON_FIELDS = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/

function clampHour(hour: number) {
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_CRON_HOUR
}

function clampWeekday(weekday: number) {
  return Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : DEFAULT_CRON_WEEKDAY
}

function intervalHours(preset: CronPreset): number | null {
  const match = preset.match(/^every_(\d+)h$/)
  return match ? Number(match[1]) : null
}

export function buildCronExpression(schedule: Pick<CronSchedule, "preset" | "hour" | "weekday">, custom?: string) {
  const hour = clampHour(schedule.hour)
  const weekday = clampWeekday(schedule.weekday)
  if (schedule.preset === "custom") return (custom || "").trim() || DEFAULT_CRON
  if (schedule.preset === "hourly") return "0 * * * *"
  const hours = intervalHours(schedule.preset)
  if (hours) return `0 */${hours} * * *`
  if (schedule.preset === "daily") return `0 ${hour} * * *`
  if (schedule.preset === "weekdays") return `0 ${hour} * * 1-5`
  return `0 ${hour} * * ${weekday}`
}

export function parseCronSchedule(cron?: string): CronSchedule {
  const expression = (cron || DEFAULT_CRON).trim() || DEFAULT_CRON
  const fallback: CronSchedule = {
    preset: "custom",
    hour: DEFAULT_CRON_HOUR,
    weekday: DEFAULT_CRON_WEEKDAY,
    expression,
  }
  const match = expression.match(CRON_FIELDS)
  if (!match) return fallback

  const [, minute, hour, dayOfMonth, month, dayOfWeek] = match
  if (minute !== "0" || dayOfMonth !== "*" || month !== "*") return fallback

  if ((hour === "*" || hour === "*/1") && dayOfWeek === "*") {
    return { preset: "hourly", hour: DEFAULT_CRON_HOUR, weekday: DEFAULT_CRON_WEEKDAY, expression }
  }

  const interval = hour.match(/^\*\/(\d+)$/)
  if (interval && dayOfWeek === "*") {
    const preset = HOUR_INTERVALS[Number(interval[1])]
    if (preset) return { preset, hour: DEFAULT_CRON_HOUR, weekday: DEFAULT_CRON_WEEKDAY, expression }
  }

  const hourNum = Number(hour)
  if (!Number.isInteger(hourNum) || hourNum < 0 || hourNum > 23) return fallback
  if (dayOfWeek === "*") return { preset: "daily", hour: hourNum, weekday: DEFAULT_CRON_WEEKDAY, expression }
  if (dayOfWeek === "1-5") return { preset: "weekdays", hour: hourNum, weekday: DEFAULT_CRON_WEEKDAY, expression }

  const weekday = Number(dayOfWeek)
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return fallback
  return { preset: "weekly", hour: hourNum, weekday, expression }
}

export function cronNeedsHour(preset: CronPreset) {
  return preset === "daily" || preset === "weekdays" || preset === "weekly"
}

export function cronNeedsWeekday(preset: CronPreset) {
  return preset === "weekly"
}
