import { format } from "date-fns"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

export function validTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

export function taskTimeZone(metadata?: Record<string, unknown> | null): string {
  const context = metadata?._calendar_context
  const contextZone = context && typeof context === "object" && "timezone" in context ? context.timezone : undefined
  const zone = metadata?.timezone || contextZone
  return validTimeZone(zone) ? zone : browserTimeZone()
}

/** DatePicker dates represent calendar days, not UTC instants. */
export function zonedTaskInstant(date: Date, time: string, zone: string, existingIso?: string): string {
  if (!validTimeZone(zone)) throw new Error("Select a valid time zone")
  const wallTime = `${format(date, "yyyy-MM-dd")}T${time}:00`
  const pattern = "yyyy-MM-dd'T'HH:mm:ss"
  if (existingIso && formatInTimeZone(existingIso, zone, pattern) === wallTime) return existingIso
  const instant = fromZonedTime(wallTime, zone)
  if (!Number.isFinite(instant.getTime()) || formatInTimeZone(instant, zone, pattern) !== wallTime) {
    throw new Error("This time does not exist in the selected time zone due to daylight saving. Select another time.")
  }
  // Detect repeated wall times rather than silently choosing an offset.
  for (const minutes of [-180, -120, -90, -60, -30, 30, 60, 90, 120, 180]) {
    const candidate = new Date(instant.getTime() + minutes * 60000)
    if (formatInTimeZone(candidate, zone, pattern) === wallTime) {
      throw new Error("This time occurs twice in the selected time zone due to daylight saving. Select another time or use UTC.")
    }
  }
  return instant.toISOString()
}