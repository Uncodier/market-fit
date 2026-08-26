import { format } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"

export const DEFAULT_RESERVATION_TZ = "America/Mexico_City"

/** system = browser/OS clock, no remapping. venue = schedule timezone (show the zone). */
export type SlotTimeDisplay = "system" | "venue"

export type ReservationSlotOption = {
  start: string
  end: string
  available: number
  timezone?: string
}

export function resolveSlotTimeZone(timeZone?: string | null): string {
  return timeZone || DEFAULT_RESERVATION_TZ
}

export function formatSlotTimeZoneName(timeZone?: string | null): string {
  const tz = resolveSlotTimeZone(timeZone)
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date())
    const shortName = parts.find((part) => part.type === "timeZoneName")?.value
    const label = tz.replace(/_/g, " ")
    return shortName && shortName !== tz ? `${label} (${shortName})` : label
  } catch {
    return tz.replace(/_/g, " ")
  }
}

export function formatSlotTime(
  iso: string,
  timeZone?: string | null,
  display: SlotTimeDisplay = "venue"
): string {
  if (display === "system") return format(new Date(iso), "h:mm a")
  return formatInTimeZone(new Date(iso), resolveSlotTimeZone(timeZone), "h:mm a")
}

export function formatSlotDateTime(
  iso: string,
  timeZone?: string | null,
  pattern = "PPP p",
  display: SlotTimeDisplay = "venue"
): string {
  if (display === "system") return format(new Date(iso), pattern)
  return formatInTimeZone(new Date(iso), resolveSlotTimeZone(timeZone), pattern)
}

export function slotCalendarDate(
  iso: string,
  timeZone?: string | null,
  display: SlotTimeDisplay = "venue"
): string {
  if (display === "system") return format(new Date(iso), "yyyy-MM-dd")
  return formatInTimeZone(new Date(iso), resolveSlotTimeZone(timeZone), "yyyy-MM-dd")
}

/** Local Date at midnight for the slot's calendar day in the active display zone. */
export function calendarDateFromIso(
  iso: string,
  timeZone?: string | null,
  display: SlotTimeDisplay = "venue"
): Date {
  const [year, month, day] = slotCalendarDate(iso, timeZone, display).split("-").map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

export function isSameSlotInstant(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  const aTime = new Date(a).getTime()
  const bTime = new Date(b).getTime()
  return Number.isFinite(aTime) && Number.isFinite(bTime) && aTime === bTime
}

export function findSlotByInstant<T extends { start: string }>(
  slots: T[],
  startIso?: string | null
): T | undefined {
  if (!startIso) return undefined
  return slots.find((slot) => isSameSlotInstant(slot.start, startIso))
}

/** Keep the current booking visible without duplicating the same instant or inventing leftover. */
export function mergeCurrentReservationSlot(
  slots: ReservationSlotOption[],
  selectedStartIso?: string | null,
  selectedEndIso?: string | null
): ReservationSlotOption[] {
  if (!selectedStartIso || !selectedEndIso) return slots
  if (findSlotByInstant(slots, selectedStartIso)) return slots

  const timezone = slots[0]?.timezone
  return [
    ...slots,
    {
      start: selectedStartIso,
      end: selectedEndIso,
      available: 0,
      ...(timezone ? { timezone } : {}),
    },
  ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
}

export function shouldShowSlotLeftover(
  slot: ReservationSlotOption,
  selectedStartIso?: string | null
): boolean {
  return !isSameSlotInstant(slot.start, selectedStartIso)
}
