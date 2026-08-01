"use client"

import { createClient } from "@/lib/supabase/client"

export interface SiteCourier {
  id: string
  name: string
}

/**
 * Load active site members + owner for courier assignment UI.
 * Fetches profiles separately to avoid fragile nested FK embeds.
 */
export async function listSiteCouriers(siteId: string): Promise<SiteCourier[]> {
  const supabase = createClient()

  const { data: memberRows } = await supabase
    .from("site_members")
    .select("user_id")
    .eq("site_id", siteId)
    .eq("status", "active")
    .not("user_id", "is", null)

  const { data: site } = await supabase
    .from("sites")
    .select("user_id")
    .eq("id", siteId)
    .single()

  const userIds = new Set<string>()
  for (const row of memberRows || []) {
    if (row.user_id) userIds.add(row.user_id)
  }
  if (site?.user_id) userIds.add(site.user_id)

  if (userIds.size === 0) return []

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", Array.from(userIds))

  const nameById = new Map((profiles || []).map((p) => [p.id, p.name || "Unknown"]))

  return Array.from(userIds).map((id) => ({
    id,
    name: nameById.get(id) || "Unknown",
  }))
}
