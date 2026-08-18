"use server"

import { revalidatePath } from "next/cache"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { CalendarBlock } from "@/app/types"

export async function getCalendarBlocks(siteId: string, startDate?: string, endDate?: string) {
  try {
    const supabase = await createClient()
    let query = supabase
      .from("calendar_blocks")
      .select("*")
      .eq("site_id", siteId)
      .order("start_time", { ascending: true })

    if (startDate) {
      query = query.gte("end_time", startDate)
    }
    if (endDate) {
      query = query.lte("start_time", endDate)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching calendar blocks:", error)
      return { data: [], error: error.message }
    }

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
