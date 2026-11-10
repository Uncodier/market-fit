"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { isKnownDemoSite } from "@/lib/demo-data"

export async function getLeadPriceListOptions(siteId: string): Promise<{
  data: { id: string; name: string; currency: string; is_active: boolean }[]
  error?: string
}> {
  const isDemo = isKnownDemoSite(siteId)
  if (!isDemo && !z.string().uuid().safeParse(siteId).success) return { data: [], error: "Invalid site." }
  try {
    const supabase = await createClient(!isDemo)
    if (isDemo) {
      if (!supabase._isDemo) return { data: [], error: "Demo price lists are unavailable." }
      const { data: site, error } = await supabase.from("sites").select("id").eq("id", siteId).maybeSingle()
      if (error || !site) return { data: [], error: "Demo site does not match the current demo." }
    } else if (supabase._isDemo) {
      return { data: [], error: "Not authorized to view price lists." }
    }
    if (!isDemo) {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) return { data: [], error: "Sign in to view price lists." }
      if (!await userCanOnSite(supabase, siteId, "select")) {
        return { data: [], error: "You do not have permission to view price lists for this site." }
      }
    }
    const lists: { id: string; name: string; currency: string; is_active: boolean }[] = []
    // Page through RLS-visible lists rather than silently truncating the picker.
    for (let offset = 0; ; offset += 500) {
      const { data, error: readError } = await supabase.from("price_lists")
        .select("id, name, currency, is_active").eq("site_id", siteId)
        .order("name").order("id").range(offset, offset + 499)
      if (readError) return { data: [], error: "Could not load price lists." }
      lists.push(...(data || []))
      if (!data || data.length < 500) return { data: lists }
    }
  } catch {
    return { data: [], error: "Could not load price lists." }
  }
}