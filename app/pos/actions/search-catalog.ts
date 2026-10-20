"use server"

import { z } from "zod"
import { searchCatalog } from "@/lib/catalog-search/server"
import { orderCatalogSearchRows } from "@/lib/catalog-search/types"
import { requirePosSiteAccess } from "./site-access"

export async function searchPosCatalog(siteId: string, query: string) {
  const input = z.object({ siteId: z.string().uuid(), query: z.string().trim().min(1).max(200) }).safeParse({ siteId, query })
  if (!input.success) return { items: [], error: "Invalid catalog search" }
  const access = await requirePosSiteAccess(siteId)
  if (access.error) return { items: [], error: access.error }
  try {
    const search = await searchCatalog({ query: input.data.query, site_id: siteId, channel: "pos",
      filters: { status: "active", parent_id: null }, limit: 20 })
    if (!search.items.length) return { ...search, items: [] }
    const { data, error } = await access.supabase.from("catalog_items")
      .select("id, site_id, name, updated_at").eq("site_id", siteId).eq("status", "active")
      .or("is_pos_available.is.null,is_pos_available.eq.true").is("parent_id", null).in("id", search.items.map(item => item.id))
    if (error) throw new Error("Hydration failed")
    const items = orderCatalogSearchRows(search.items, (data || []) as Array<{
      id: string; site_id: string; name: string; updated_at: string
    }>)
    return { ...search, items }
  } catch {
    return { items: [], error: "Online search is unavailable. Local catalog search still works." }
  }
}