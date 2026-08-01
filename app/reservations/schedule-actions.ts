"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { ReservationSchedule } from "@/app/types"

export async function listReservationSchedules(siteId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("reservation_schedules")
    .select(`
      *,
      catalog_item:catalog_items(name, image_url)
    `)
    .eq("site_id", siteId)
  
  if (error) return { error: error.message }
  return { data }
}

export async function getScheduleByCatalogItem(catalogItemId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("reservation_schedules")
    .select("*")
    .eq("catalog_item_id", catalogItemId)
    .order("created_at", { ascending: true })
  
  if (error) return { error: error.message }
  return { data }
}

export async function getScheduleByCatalogItemAdmin(catalogItemId: string) {
  const supabase = await createServiceClient(true)
  const { data, error } = await supabase
    .from("reservation_schedules")
    .select("*")
    .eq("catalog_item_id", catalogItemId)
    .order("created_at", { ascending: true })
  
  if (error) return { error: error.message }
  return { data }
}

export async function upsertReservationSchedule(scheduleData: Partial<ReservationSchedule>) {
  const supabase = await createClient()
  
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return { error: "Unauthorized" }

  const { data, error } = await supabase
    .from("reservation_schedules")
    .upsert({ ...scheduleData, updated_at: new Date().toISOString() })
    .select()
    .single()
    
  if (error) return { error: error.message }
  return { data }
}

export async function deleteReservationSchedule(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("reservation_schedules")
    .delete()
    .eq("id", id)
    
  if (error) return { error: error.message }
  return { success: true }
}
