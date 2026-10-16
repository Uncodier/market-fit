import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { RankingCandidate } from "./marketplace-ranking"
import type { MarketplaceArea } from "./marketplace-product-filters"
import { readAllRows } from "./load-marketplace-sales"

/** Only derive public country facets from sellers with already-authorized listings. */
export async function loadMarketplaceAreas(supabase: SupabaseClient, items: RankingCandidate[]) {
  const bySite = new Map<string, MarketplaceArea[]>()
  const siteIds = [...new Set(items.map(item => item.site_id))]
  for (let index = 0; index < siteIds.length; index += 100) {
    const ids = siteIds.slice(index, index + 100)
    const [settings, locations] = await Promise.all([
      readAllRows<{ site_id: string; locations: unknown }>((from, to) => supabase.from("settings")
        .select("site_id, locations").in("site_id", ids).order("site_id").range(from, to)),
      readAllRows<{ site_id: string; country: string | null; city: string | null; state: string | null; zip: string | null }>((from, to) =>
        supabase.from("locations").select("site_id, country, city, state, zip")
          .in("site_id", ids).eq("is_active", true).order("id").range(from, to)),
    ])
    const add = (siteId: string, value: unknown) => {
      if (!ids.includes(siteId) || !value || typeof value !== "object" || Array.isArray(value)) return
      const row = value as Record<string, unknown>
      const area: MarketplaceArea = {}
      for (const key of ["city", "country", "state", "zip"] as const) {
        if (typeof row[key] === "string" && row[key].trim()) area[key] = row[key].trim()
      }
      if (!Object.keys(area).length) return
      bySite.set(siteId, [...(bySite.get(siteId) || []), area])
    }
    for (const settingsRow of settings) {
      if (Array.isArray(settingsRow.locations)) for (const area of settingsRow.locations) add(settingsRow.site_id, area)
    }
    for (const location of locations) add(location.site_id, location)
  }
  return bySite
}