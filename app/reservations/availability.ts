"use server"

import { createServiceClient } from "@/lib/supabase/server"
import {
  addMinutes,
  parseISO,
  startOfDay,
  endOfDay,
  isAfter,
  isBefore,
  setHours,
  setMinutes,
  eachDayOfInterval,
  format,
} from "date-fns"

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

  const days = eachDayOfInterval({ start: parseISO(startDateStr), end: parseISO(endDateStr) })
  const result: { start: string; end: string; available: number }[] = []

  // 2. Get reservations
  const { data: reservations } = await supabase
    .from("reservations")
    .select("start_time, end_time, quantity, status")
    .eq("catalog_item_id", catalogItemId)
    .in("status", ["pending", "confirmed"])
    .gte("start_time", startOfDay(parseISO(startDateStr)).toISOString())
    .lte("end_time", endOfDay(parseISO(endDateStr)).toISOString())

  for (const dateObj of days) {
    const dayOfWeek = format(dateObj, "eeee").toLowerCase()
    
    for (const schedule of schedules) {
      const dayConfig = schedule.days[dayOfWeek]
      if (!dayConfig?.enabled) continue

      const duration = schedule.duration_minutes || 60
      const capacity = schedule.capacity || 1

      const blocks = dayConfig.timeBlocks || (dayConfig.start && dayConfig.end ? [{ start: dayConfig.start, end: dayConfig.end }] : [])
      
      for (const block of blocks) {
        if (!block.start || !block.end) continue

        const [startH, startM] = block.start.split(":").map(Number)
        const [endH, endM] = block.end.split(":").map(Number)

        const dayStart = setMinutes(setHours(dateObj, startH), startM)
        const dayEnd = setMinutes(setHours(dateObj, endH), endM)

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

  const dayOfWeek = format(start, "eeee").toLowerCase()
  
  // Find a schedule that accommodates this slot
  let validScheduleFound = false
  let capacityError = false
  
  for (const schedule of schedules) {
    const dayConfig = schedule.days[dayOfWeek]
    if (!dayConfig?.enabled) continue

    const blocks = dayConfig.timeBlocks || (dayConfig.start && dayConfig.end ? [{ start: dayConfig.start, end: dayConfig.end }] : [])
    if (blocks.length === 0) continue

    let isWithinAnyBlock = false
    for (const block of blocks) {
      if (!block.start || !block.end) continue

      const [startH, startM] = block.start.split(":").map(Number)
      const [endH, endM] = block.end.split(":").map(Number)

      const dayStart = setMinutes(setHours(start, startH), startM)
      const dayEnd = setMinutes(setHours(start, endH), endM)

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
