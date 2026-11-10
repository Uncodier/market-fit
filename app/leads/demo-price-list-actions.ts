"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { isKnownDemoSite } from "@/lib/demo-data"

const demoAssignmentSchema = z.object({
  id: z.string().min(1).max(200),
  site_id: z.string().refine(isKnownDemoSite),
  default_price_list_id: z.string().min(1).max(200).nullable(),
}).strict()

/** Demo edits use only the existing in-memory client, never the real database. */
export async function updateDemoLeadPriceList(input: unknown): Promise<{ error?: string; success?: boolean }> {
  const parsed = demoAssignmentSchema.safeParse(input)
  if (!parsed.success) return { error: "Invalid demo price-list assignment." }
  try {
    const supabase = await createClient(false)
    if (!supabase._isDemo) return { error: "Demo price lists are unavailable." }
    const { id, site_id, default_price_list_id } = parsed.data
    const { data: site, error: siteError } = await supabase.from("sites")
      .select("id").eq("id", site_id).maybeSingle()
    if (siteError || !site) return { error: "Demo site does not match the current demo." }
    if (default_price_list_id !== null) {
      const { data: list, error } = await supabase.from("price_lists").select("id")
        .eq("id", default_price_list_id).eq("site_id", site_id).eq("is_active", true).maybeSingle()
      if (error || !list) return { error: "Select an active price list from this demo." }
    }
    const { data, error } = await supabase.from("leads").update({ default_price_list_id })
      .eq("id", id).eq("site_id", site_id).select("id").single()
    if (error || !data) return { error: "Demo lead not found or price list could not be saved." }
    return { success: true }
  } catch {
    return { error: "Could not save the demo price list." }
  }
}