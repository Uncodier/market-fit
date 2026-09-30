"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { userCanOnSite } from "@/lib/permissions/site-access"

const uuid = z.string().uuid()

export async function deleteSubscription(siteId: string, subscriptionId: string) {
  if (!uuid.safeParse(siteId).success || !uuid.safeParse(subscriptionId).success) {
    return { error: "Invalid subscription request" }
  }

  try {
    const supabase = await createClient(true)
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { error: "Not authenticated" }
    }

    if (!(await userCanOnSite(supabase, siteId, "delete"))) {
      return { error: "Not authorized to delete subscriptions" }
    }

    // Check the current status in the DELETE itself, not in a separate read.
    // Existing invoices are retained by the sales foreign key's ON DELETE SET NULL.
    const { data, error } = await supabase
      .from("subscriptions")
      .delete()
      .eq("site_id", siteId)
      .eq("id", subscriptionId)
      .eq("status", "cancelled")
      .select("id")
      .maybeSingle()

    if (error) {
      return { error: "Failed to delete subscription" }
    }

    if (!data) {
      return { error: "Subscription not found or no longer cancelled" }
    }

    revalidatePath("/subscriptions")
    revalidatePath(`/subscriptions/${subscriptionId}`)
    revalidatePath("/sales")
    return { success: true }
  } catch {
    return { error: "Failed to delete subscription" }
  }
}