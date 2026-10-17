"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { Subscription } from "@/app/types"
import { requireAccountingAccess } from "@/app/accounting/access"
import { isDateOnly } from "@/lib/finance/due-date"
import { getSubscriptionAmountError, getSubscriptionEndDateError } from "./detail-validation"

export async function updateSubscriptionAmount(siteId: string, subscriptionId: string, value: number) {
  const error = getSubscriptionAmountError(value)
  if (error) return { error }
  return saveSubscriptionDetails(siteId, subscriptionId, { amount: value })
}

export async function updateSubscriptionEndDate(siteId: string, subscriptionId: string, value: string | null) {
  if (value !== null && value !== "" && !isDateOnly(value)) return { error: "Enter a valid end date (YYYY-MM-DD)" }
  return saveSubscriptionDetails(siteId, subscriptionId, { end_date: value || null })
}

async function saveSubscriptionDetails(siteId: string, subscriptionId: string, update: { amount: number } | { end_date: string | null }): Promise<{
  data?: Pick<Subscription, "amount" | "end_date" | "updated_at">
  error?: string
}> {
  if (!z.string().uuid().safeParse(siteId).success || !z.string().uuid().safeParse(subscriptionId).success) {
    return { error: "Invalid subscription request" }
  }
  let supabase: Awaited<ReturnType<typeof requireAccountingAccess>>
  try {
    supabase = await requireAccountingAccess(siteId, "update")
  } catch {
    return { error: "Not authorized to edit subscriptions in this site" }
  }
  try {
    const { data: current, error: readError } = await supabase.from("subscriptions")
      .select("start_date, updated_at").eq("site_id", siteId).eq("id", subscriptionId).maybeSingle()
    if (readError || !current) return { error: "Subscription not found" }
    const revision = new Date(current.updated_at || "").getTime()
    if (!Number.isFinite(revision)) return { error: "Unable to verify the subscription. Reload and retry." }
    if ("end_date" in update) {
      const error = getSubscriptionEndDateError(update.end_date, current.start_date)
      if (error) return { error }
    }
    const { data, error } = await supabase.from("subscriptions")
      .update({ ...update, updated_at: new Date(Math.max(Date.now(), revision + 1)).toISOString() })
      .eq("site_id", siteId).eq("id", subscriptionId).eq("updated_at", current.updated_at)
      .select("amount, end_date, updated_at").maybeSingle()
    if (error) return { error: "Unable to save subscription details" }
    if (!data) return { error: "Subscription changed while editing. Reload and retry." }
    revalidatePath("/subscriptions")
    revalidatePath(`/subscriptions/${subscriptionId}`)
    return { data: data as Pick<Subscription, "amount" | "end_date" | "updated_at"> }
  } catch {
    return { error: "Unable to save subscription details" }
  }
}