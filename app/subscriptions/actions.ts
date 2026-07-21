"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { Subscription } from "@/app/types";

export async function getSubscriptions(siteId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("subscriptions")
      .select(`
        *,
        catalog_item:catalog_items(id, name, description, kind),
        lead:leads(id, name, email, phone)
      `)
      .eq("site_id", siteId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching subscriptions:", error);
      return { data: [], error: error.message };
    }
    
    return { data: data as Subscription[] };
  } catch (error: any) {
    return { data: [], error: error.message };
  }
}

export async function upsertSubscription(subscription: Partial<Subscription>) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("subscriptions")
      .upsert({
        ...subscription,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return { error: error.message };
    
    revalidatePath("/subscriptions");
    return { data: data as Subscription };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function updateSubscriptionStatus(siteId: string, subscriptionId: string, status: Subscription['status']) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("subscriptions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", subscriptionId)
      .eq("site_id", siteId)
      .select()
      .single();

    if (error) return { error: error.message };
    
    revalidatePath("/subscriptions");
    return { data: data as Subscription };
  } catch (error: any) {
    return { error: error.message };
  }
}
