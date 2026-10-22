import type { Reservation } from "@/app/types"
import type { ReservationReadWindow } from "../read-window"
import { localDateKey } from "./reservation-calendar-select"

// Clip display copies, never the records used by editing/payment actions.
export function groupReservationSpans(reservations: Reservation[], window: ReservationReadWindow) {
  const grouped: Record<string, Reservation[]> = {}
  const from = Date.parse(window.start), to = Date.parse(window.end)
  for (const reservation of reservations) {
    const start = Math.max(Date.parse(reservation.start_time), from)
    const end = Math.min(reservation.end_time ? Date.parse(reservation.end_time) : to, to)
    if (!(end > start)) continue
    const at = new Date(start)
    let day = new Date(at.getFullYear(), at.getMonth(), at.getDate())
    while (day.getTime() < end) {
      const next = new Date(day); next.setDate(next.getDate() + 1)
      const key = localDateKey(day)
      ;(grouped[key] ||= []).push({
        ...reservation,
        start_time: new Date(Math.max(start, day.getTime())).toISOString(),
        end_time: new Date(Math.min(end, next.getTime() - 1)).toISOString(),
      })
      day = next
    }
  }
  return grouped
}