import "server-only"
import { getBuyerAssignments, getBuyerPriceContext, type BuyerPriceContext } from "./buyer-price-context"
import { isPriceListAllowedForChannel } from "./price-list-channels"

export { getBuyerPriceContext } from "./buyer-price-context"
export type { BuyerPriceContext } from "./buyer-price-context"

export type BuyerPriceItem = {
  id: string; site_id: string; target_sale_price?: number | null; currency?: string | null
  _buyerPriceBase?: { target_sale_price: number | null; currency: string | null }
}
type List = { id: string; site_id: string; currency: string | null; channels: string[] | null }
export type BuyerPriceMap = {
  priceByItemId: Map<string, number>
  currencyByItemId: Map<string, string>
  listIdBySiteId: Map<string, string>
}
const chunks = <T,>(values: T[]) => Array.from({ length: Math.ceil(values.length / 200) }, (_, i) => values.slice(i * 200, i * 200 + 200))

/** Inputs are already visibility-authorized catalog items; identity is never a tool/client argument. */
export async function loadBuyerPriceMap(
  items: Pick<BuyerPriceItem, "id" | "site_id">[], channel: "shop" | "marketplace",
  context?: BuyerPriceContext | null,
): Promise<BuyerPriceMap> {
  const result: BuyerPriceMap = { priceByItemId: new Map(), currencyByItemId: new Map(), listIdBySiteId: new Map() }
  if (!items.length) return result
  const buyer = context === undefined ? await getBuyerPriceContext() : context
  if (!buyer) return result
  const ownerByItem = new Map(items.map(item => [item.id, item.site_id]))
  const assignments = await getBuyerAssignments(buyer, [...new Set(items.map(item => item.site_id))])
  if (!assignments.size) return result
  const lists: List[] = []
  for (const ids of chunks([...new Set(assignments.values())])) {
    const { data, error } = await buyer.client.from("price_lists").select("id, site_id, currency, channels")
      .in("id", ids).eq("is_active", true)
    if (error) throw new Error("Unable to verify buyer price lists.")
    lists.push(...(data || []))
  }
  const allowed = new Map(lists.filter(list => assignments.get(list.site_id) === list.id &&
    isPriceListAllowedForChannel(list.channels, channel)).map(list => [list.id, list]))
  for (const list of allowed.values()) result.listIdBySiteId.set(list.site_id, list.id)
  for (const listIds of chunks([...allowed.keys()])) {
    for (const itemIds of chunks([...ownerByItem.keys()])) {
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await buyer.client.from("price_list_items")
          .select("price_list_id, catalog_item_id, site_id, unit_price").in("price_list_id", listIds)
          .in("catalog_item_id", itemIds).order("price_list_id").order("catalog_item_id").range(offset, offset + 499)
        if (error) throw new Error("Unable to load buyer prices.")
        for (const row of data || []) {
          const list = allowed.get(row.price_list_id)
          const price = Number(row.unit_price)
          if (!list || row.site_id !== list.site_id || ownerByItem.get(row.catalog_item_id) !== list.site_id ||
            row.unit_price == null || !Number.isFinite(price) || price <= 0) continue
          result.priceByItemId.set(row.catalog_item_id, price)
          if (list.currency) result.currencyByItemId.set(row.catalog_item_id, list.currency)
        }
        if (!data || data.length < 500) break
      }
    }
  }
  return result
}

/** Overlay outside public caches. A selected personal list falls back to raw catalog prices. */
export async function applyBuyerPricesToItems<T extends BuyerPriceItem>(
  items: T[], channel: "shop" | "marketplace", context?: BuyerPriceContext | null,
): Promise<T[]> {
  const prices = await loadBuyerPriceMap(items, channel, context)
  if (!prices.listIdBySiteId.size) return items
  return items.map(item => {
    if (!prices.listIdBySiteId.has(item.site_id)) return item
    const base = item._buyerPriceBase || { target_sale_price: item.target_sale_price ?? null, currency: item.currency ?? null }
    const price = prices.priceByItemId.get(item.id)
    return {
      ...item, target_sale_price: price ?? base.target_sale_price,
      currency: price !== undefined ? prices.currencyByItemId.get(item.id) || base.currency : base.currency,
    }
  })
}