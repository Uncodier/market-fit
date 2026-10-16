import type { BuyerGeo } from "@/app/commerce/buyer-geo"
import { normalizeCountry } from "@/app/commerce/location-restrictions"
import { convertAmount } from "@/app/lib/fx"
import type { MarketplaceSort } from "./marketplace-sort"

export type RankingCandidate = {
  id: string
  site_id: string
  created_at: string
  target_sale_price?: number | null
  currency?: string | null
}

export type SalesScore = { global: number; local: number }
type Area = Pick<BuyerGeo, "city" | "state" | "country" | "zip">

function normalize(value?: string) {
  return (value || "").trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
}

/** Match the most specific known area, without treating missing geography as local. */
export function matchesBuyerArea(area: Area | null | undefined, buyer?: BuyerGeo): boolean {
  if (!area || !buyer) return false
  if (buyer.country && area.country && normalizeCountry(buyer.country) !== normalizeCountry(area.country)) return false
  if (buyer.state && area.state && normalize(buyer.state) !== normalize(area.state)) return false
  if (buyer.city) return Boolean(area.city && normalize(buyer.city) === normalize(area.city))
  if (buyer.zip) return Boolean(area.zip && normalize(buyer.zip) === normalize(area.zip))
  if (buyer.state) return Boolean(area.state && normalize(buyer.state) === normalize(area.state))
  return Boolean(buyer.country && area.country && normalizeCountry(buyer.country) === normalizeCountry(area.country))
}

export function rankMarketplaceCandidates<T extends RankingCandidate>(
  items: T[],
  sort: MarketplaceSort,
  scores: Map<string, SalesScore> = new Map(),
  rates: Record<string, number> = {},
): T[] {
  const price = (item: T) => {
    if (item.target_sale_price == null) return null
    const value = convertAmount(Number(item.target_sale_price), item.currency || "USD", "USD", rates)
    return value != null && Number.isFinite(value) ? value : null
  }
  return [...items].sort((a, b) => {
    if (sort === "price_asc" || sort === "price_desc") {
      const ap = price(a)
      const bp = price(b)
      if (ap == null && bp != null) return 1
      if (bp == null && ap != null) return -1
      if (ap != null && bp != null && ap !== bp) return sort === "price_asc" ? ap - bp : bp - ap
    }
    if (sort === "featured" || sort === "best_selling") {
      const as = scores.get(a.id) || { global: 0, local: 0 }
      const bs = scores.get(b.id) || { global: 0, local: 0 }
      if (sort === "featured" && as.local !== bs.local) return bs.local - as.local
      if (as.global !== bs.global) return bs.global - as.global
    }
    return b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)
  })
}