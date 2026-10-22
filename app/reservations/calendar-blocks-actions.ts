"use server"

import { revalidatePath } from "next/cache"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { CalendarBlock } from "@/app/types"
import { reservationReadClient } from "./read-access"
import { readAllPages, READ_PAGE_SIZE } from "./read-pages"
import { validateReadWindow, type ReservationReadWindow } from "./read-window"

export async function getCalendarBlocks(siteId: string, startDate?: string | ReservationReadWindow, endDate?: string) {
  try {
    const window = typeof startDate === "object"
      ? validateReadWindow(startDate)
      : startDate && endDate ? validateReadWindow({ start: startDate, end: endDate }) : undefined
    const supabase = await reservationReadClient(siteId)
    const data = await readAllPages<CalendarBlock>((offset, signal) => {
      let query = supabase
      .from("calendar_blocks")
      .select("id, site_id, entity_type, entity_id, start_time, end_time, reason, created_at, updated_at")
      .eq("site_id", siteId)
      .order("start_time", { ascending: true }).order("id", { ascending: true })

      if (window) query = query.lt("start_time", window.end).or(`end_time.is.null,end_time.gt.${window.start}`)
      else {
        // Preserve the pre-existing one-sided legacy caller contract.
        if (typeof startDate === "string" && startDate) query = query.gte("end_time", startDate)
        if (endDate) query = query.lte("start_time", endDate)
      }
      return query.range(offset, offset + READ_PAGE_SIZE - 1).abortSignal(signal)
    })

    return { data: data as CalendarBlock[] }
  } catch (error: any) {
    return { data: [], error: error.message }
  }
}

export async function upsertCalendarBlock(block: Partial<CalendarBlock>) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("calendar_blocks")
      .upsert({
        ...block,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return { error: error.message }
    
    revalidatePath("/reservations")
    return { data: data as CalendarBlock }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function deleteCalendarBlock(id: string) {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from("calendar_blocks")
      .delete()
      .eq("id", id)

    if (error) return { error: error.message }
    
    revalidatePath("/reservations")
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}
