"use server"

import { createServiceClient } from "@/lib/supabase/server"
import {
  addDays,
  addMinutes,
  parseISO,
  isAfter,
  isBefore,
} from "date-fns"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"

const DEFAULT_TZ = "UTC"

function toDateStr(value: string): string {
  return value.slice(0, 10)
}

function normalizeTime(time: string): string {
  const [h = "00", m = "00", s = "00"] = time.split(":")
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${(s || "00").padStart(2, "0")}`
}

/** Instant for a wall-clock date+time in the schedule timezone. */
function zonedDateTime(dateStr: string, time: string, timeZone: string): Date {
  return fromZonedTime(`${dateStr}T${normalizeTime(time)}`, timeZone)
}

function eachDateString(startDateStr: string, endDateStr: string): string[] {
  const start = toDateStr(startDateStr)
  const end = toDateStr(endDateStr)
  const result: string[] = []
  // Noon UTC avoids day-boundary shifts when stepping calendar dates
  let current = parseISO(`${start}T12:00:00Z`)
  const last = parseISO(`${end}T12:00:00Z`)
  while (current.getTime() <= last.getTime()) {
    result.push(formatInTimeZone(current, "UTC", "yyyy-MM-dd"))
    current = addDays(current, 1)
  }
  return result
}

function dayOfWeekInZone(dateStr: string, timeZone: string): string {
  return formatInTimeZone(
    zonedDateTime(dateStr, "12:00:00", timeZone),
    timeZone,
    "eeee"
  ).toLowerCase()
}

function getTimeBlocks(dayConfig: any): { start: string; end: string }[] {
  if (dayConfig.timeBlocks?.length) return dayConfig.timeBlocks
  if (dayConfig.start && dayConfig.end) {
    return [{ start: dayConfig.start, end: dayConfig.end }]
  }
  return []
}

export async function getBookedSeats(
  catalogItemId: string,
  start: Date,
  end: Date,
  supabaseClient: any,
  ignoreReservationId?: string
) {
  // get overlapping reservations
  let query = supabaseClient
    .from("reservations")
    .select("id, quantity, status")
    .eq("catalog_item_id", catalogItemId)
    .in("status", ["pending", "confirmed"])
    .gte("end_time", start.toISOString())
    .lte("start_time", end.toISOString())

  if (ignoreReservationId) {
    query = query.neq("id", ignoreReservationId)
  }

  const { data: reservations, error } = await query

  if (error) {
    console.error("Error fetching booked seats:", error)
    return 0
  }

  return (reservations || []).reduce((acc: number, res: any) => acc + (res.quantity || 1), 0)
}

export async function getAvailableSlots(
  catalogItemId: string,
  startDateStr: string,
  endDateStr: string,
  qty: number = 1
) {
  const supabase = await createServiceClient(true)
  
  // 1. Get schedules
  const { data: schedules } = await supabase
    .from("reservation_schedules")
    .select("*")
    .eq("catalog_item_id", catalogItemId)

  if (!schedules || schedules.length === 0) return []

  const dateStrs = eachDateString(startDateStr, endDateStr)
  const result: { start: string; end: string; available: number }[] = []

  // Pad query window so evening slots near UTC day boundaries are included
  const rangeStart = addDays(parseISO(`${toDateStr(startDateStr)}T00:00:00Z`), -1)
  const rangeEnd = addDays(parseISO(`${toDateStr(endDateStr)}T23:59:59Z`), 1)

  // 2. Get reservations
  const { data: reservations } = await supabase
    .from("reservations")
    .select("start_time, end_time, quantity, status")
    .eq("catalog_item_id", catalogItemId)
    .in("status", ["pending", "confirmed"])
    .gte("start_time", rangeStart.toISOString())
    .lte("end_time", rangeEnd.toISOString())

  for (const dateStr of dateStrs) {
    for (const schedule of schedules) {
      const timeZone = schedule.timezone || DEFAULT_TZ
      const dayOfWeek = dayOfWeekInZone(dateStr, timeZone)
      const dayConfig = schedule.days?.[dayOfWeek]
      if (!dayConfig?.enabled) continue

      const duration = schedule.duration_minutes || 60
      const capacity = schedule.capacity || 1
      const blocks = getTimeBlocks(dayConfig)
      
      for (const block of blocks) {
        if (!block.start || !block.end) continue

        const dayStart = zonedDateTime(dateStr, block.start, timeZone)
        const dayEnd = zonedDateTime(dateStr, block.end, timeZone)

        let current = dayStart
        while (isBefore(current, dayEnd)) {
          const slotEnd = addMinutes(current, duration)
          if (isAfter(slotEnd, dayEnd)) break
          
          // Calculate booked seats
          const booked = (reservations || []).filter((r: any) => {
            const rStart = new Date(r.start_time)
            const rEnd = new Date(r.end_time)
            return isBefore(current, rEnd) && isAfter(slotEnd, rStart)
          }).reduce((acc: number, r: any) => acc + (r.quantity || 1), 0)

          const available = capacity - booked

          if (available >= qty && isAfter(current, new Date())) {
            // Check if slot already exists in result to avoid duplicates from overlapping schedules
            const existing = result.find(r => r.start === current.toISOString() && r.end === slotEnd.toISOString())
            if (existing) {
              existing.available = Math.max(existing.available, available)
            } else {
              result.push({
                start: current.toISOString(),
                end: slotEnd.toISOString(),
                available
              })
            }
          }
          
          current = slotEnd
        }
      }
    }
  }

  // Sort results by start time
  return result.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
}

export async function assertReservationSlot(
  siteId: string,
  catalogItemId: string,
  startIso: string,
  endIso: string,
  quantity: number,
  isAdmin: boolean = false,
  ignoreReservationId?: string
) {
  const supabase = await createServiceClient(true)
  const { data: schedules } = await supabase
    .from("reservation_schedules")
    .select("*")
    .eq("catalog_item_id", catalogItemId)

  if (!schedules || schedules.length === 0) {
    throw new Error("Item is reservable but has no schedule configured")
  }

  const start = parseISO(startIso)
  const end = parseISO(endIso)
  
  if (isBefore(start, new Date()) && !isAdmin) {
    throw new Error("Cannot book in the past")
  }
  
  // Find a schedule that accommodates this slot
  let validScheduleFound = false
  let capacityError = false
  
  for (const schedule of schedules) {
    const timeZone = schedule.timezone || DEFAULT_TZ
    const dateStr = formatInTimeZone(start, timeZone, "yyyy-MM-dd")
    const dayOfWeek = dayOfWeekInZone(dateStr, timeZone)
    const dayConfig = schedule.days?.[dayOfWeek]
    if (!dayConfig?.enabled) continue

    const blocks = getTimeBlocks(dayConfig)
    if (blocks.length === 0) continue

    let isWithinAnyBlock = false
    for (const block of blocks) {
      if (!block.start || !block.end) continue

      const dayStart = zonedDateTime(dateStr, block.start, timeZone)
      const dayEnd = zonedDateTime(dateStr, block.end, timeZone)

      if (!isBefore(start, dayStart) && !isAfter(end, dayEnd)) {
        isWithinAnyBlock = true
        break
      }
    }

    if (isWithinAnyBlock) {
      const booked = await getBookedSeats(catalogItemId, start, end, supabase, ignoreReservationId)
      if (schedule.capacity - booked >= quantity) {
        validScheduleFound = true
        break
      } else {
        capacityError = true
      }
    }
  }

  if (validScheduleFound) {
    return true
  } else if (capacityError) {
    throw new Error("Not enough capacity for this slot")
  } else {
    throw new Error("Slot is outside of available schedule hours")
  }
}
