import "server-only"
import { loadChannelPriceMap } from "@/app/price-lists/apply-channel-prices"
import type { CheckoutSupabaseClient } from "./checkout-types"
import type { Tax } from "@/app/types"

/** Reuse the already authorized kiosk client; never reconstruct a workspace session. */
export async function loadSelfServicePricing(client: CheckoutSupabaseClient, siteId: string, itemIds: string[]) {
  const ids = [...new Set(itemIds)]
  const [prices, taxes] = await Promise.all([
    loadChannelPriceMap(client, [siteId], "shop", ids),
    client.from("catalog_item_taxes").select("catalog_item_id, tax:taxes(*)").eq("site_id", siteId).in("catalog_item_id", ids),
  ])
  if (taxes.error || !taxes.data) throw new Error("Unable to verify checkout taxes.")
  const taxesByItem: Record<string, Tax[]> = {}
  for (const row of taxes.data) {
    const tax = (Array.isArray(row.tax) ? row.tax[0] : row.tax) as Tax | null
    if (!tax || tax.is_active === false) continue
    if (!Number.isFinite(Number(tax.rate)) || Number(tax.rate) < 0 || Number(tax.rate) > 100) throw new Error("Invalid checkout tax.")
    ;(taxesByItem[row.catalog_item_id] ||= []).push(tax)
  }
  return { ...prices, taxesByItem }
}