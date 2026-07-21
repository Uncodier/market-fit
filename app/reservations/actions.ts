"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Reservation } from "@/app/types";

export async function getReservations(siteId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reservations")
      .select(`
        *,
        catalog_item:catalog_items(id, name, description, kind),
        lead:leads(id, name, email, phone)
      `)
      .eq("site_id", siteId)
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Error fetching reservations:", error);
      return { data: [], error: error.message };
    }
    
    return { data: data as Reservation[] };
  } catch (error: any) {
    return { data: [], error: error.message };
  }
}

export async function upsertReservation(reservation: Partial<Reservation>) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reservations")
      .upsert({
        ...reservation,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return { error: error.message };
    
    revalidatePath("/reservations");
    return { data: data as Reservation };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateReservationStatus(siteId: string, reservationId: string, status: Reservation['status']) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reservations")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", reservationId)
      .eq("site_id", siteId)
      .select()
      .single();

    if (error) return { error: error.message };
    
    revalidatePath("/reservations");
    return { data: data as Reservation };
  } catch (error: any) {
    return { error: error.message };
  }
}
