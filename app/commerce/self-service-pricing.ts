import "server-only"
import { loadChannelPriceMap } from "@/app/price-lists/apply-channel-prices"
import type { CheckoutSupabaseClient } from "./checkout-types"
import type { Tax } from "@/app/types"
import { loadBuyerPriceMap, type BuyerPriceContext } from "@/app/price-lists/buyer-prices"

/** Reuse the already authorized kiosk client; never reconstruct a workspace session. */
export async function loadSelfServicePricing(client: CheckoutSupabaseClient, siteId: string, itemIds: string[], channel: "shop" | "marketplace" = "shop", buyer: BuyerPriceContext | null = null) {
  const ids = [...new Set(itemIds)]
  const [prices, taxes, personal] = await Promise.all([
    loadChannelPriceMap(client, [siteId], channel, ids),
    client.from("catalog_item_taxes").select("catalog_item_id, tax:taxes(*)").eq("site_id", siteId).in("catalog_item_id", ids),
    buyer ? loadBuyerPriceMap(ids.map(id => ({ id, site_id: siteId })), channel, buyer) : null,
  ])
  const currencyByItemId = new Map<string, string>()
  for (const id of prices.priceByItemId.keys()) {
    const currency = prices.currencyBySiteId.get(siteId)
    if (currency) currencyByItemId.set(id, currency)
  }
  if (personal?.listIdBySiteId.has(siteId)) {
    // Personal list overrides the default list; missing prices use the raw catalog.
    prices.priceByItemId.clear()
    currencyByItemId.clear()
    for (const [id, price] of personal.priceByItemId) prices.priceByItemId.set(id, price)
    for (const [id, currency] of personal.currencyByItemId) currencyByItemId.set(id, currency)
    prices.listIdBySiteId.set(siteId, personal.listIdBySiteId.get(siteId)!)
  }
  if (taxes.error || !taxes.data) throw new Error("Unable to verify checkout taxes.")
  const taxesByItem: Record<string, Tax[]> = {}
  for (const row of taxes.data) {
    const tax = (Array.isArray(row.tax) ? row.tax[0] : row.tax) as Tax | null
    if (!tax || tax.is_active === false) continue
    if (!Number.isFinite(Number(tax.rate)) || Number(tax.rate) < 0 || Number(tax.rate) > 100) throw new Error("Invalid checkout tax.")
    ;(taxesByItem[row.catalog_item_id] ||= []).push(tax)
  }
  return { ...prices, currencyByItemId, taxesByItem }
}