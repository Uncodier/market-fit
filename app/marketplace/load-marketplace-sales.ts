import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { BuyerGeo } from "@/app/commerce/buyer-geo"
import { matchesBuyerArea, type RankingCandidate, type SalesScore } from "./marketplace-ranking"

const BATCH_SIZE = 100
const ROW_PAGE_SIZE = 500

/** Page through lightweight rows rather than silently accepting the Data API row cap. */
export async function readAllRows<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += ROW_PAGE_SIZE) {
    const { data, error } = await query(from, from + ROW_PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data || []))
    if (!data || data.length < ROW_PAGE_SIZE) return rows
  }
}

type Area = { city?: string; state?: string; country?: string; zip?: string }
type SaleLine = {
  catalog_item_id: string
  site_id: string
  quantity: number | string
  status: string
  order: {
    site_id: string
    status: string
    fulfillment_method: string
    shipping_address: Area | null
    origin: Area | null
    sale: { site_id: string; status: string }
  }
}

/** Internal-only aggregate: never return order addresses or payment data to the browser. */
export async function loadMarketplaceSales(
  supabase: SupabaseClient,
  candidates: RankingCandidate[],
  buyerGeo?: BuyerGeo,
): Promise<Map<string, SalesScore>> {
  const scores = new Map<string, SalesScore>()
  for (let index = 0; index < candidates.length; index += BATCH_SIZE) {
    const batch = candidates.slice(index, index + BATCH_SIZE)
    const byId = new Map(batch.map(item => [item.id, item]))
    const children = await readAllRows<{ id: string; parent_id: string; site_id: string }>((from, to) =>
      supabase.from("catalog_items").select("id, parent_id, site_id")
        .in("parent_id", batch.map(item => item.id)).order("id").range(from, to),
    )
    const parentByChild = new Map(children.filter(child =>
      child.site_id === byId.get(child.parent_id)?.site_id,
    ).map(child => [child.id, child.parent_id]))
    const ids = [...byId.keys(), ...parentByChild.keys()]
    // Bound IN clauses even for products with many variants.
    for (let offset = 0; offset < ids.length; offset += BATCH_SIZE) {
      const lines = await readAllRows<SaleLine>((from, to) => supabase.from("sale_order_items")
        .select("catalog_item_id, site_id, quantity, status, order:sale_orders!inner(site_id, status, fulfillment_method, shipping_address, origin:locations!origin_location_id(city, state, zip, country), sale:sales!inner(site_id, status))")
        .in("catalog_item_id", ids.slice(offset, offset + BATCH_SIZE))
        .in("order.sale.status", ["completed", "paid"])
        .is("parent_sale_order_item_id", null)
        .order("id").range(from, to)
        .then(({ data, error }) => ({ data: data as unknown as SaleLine[] | null, error })))
      for (const line of lines) {
        const id = parentByChild.get(line.catalog_item_id) || line.catalog_item_id
        const candidate = byId.get(id)
        const order = line.order
        if (!candidate || !order || !order.sale) continue
        if (line.site_id !== candidate.site_id || order.site_id !== candidate.site_id || order.sale.site_id !== candidate.site_id) continue
        if (!["completed", "paid"].includes(order.sale.status)) continue
        if (["cancelled", "refunded", "draft"].includes(order.status) || ["cancelled", "refunded"].includes(line.status)) continue
        const quantity = Number(line.quantity)
        if (!Number.isFinite(quantity) || quantity <= 0) continue
        const area = order.fulfillment_method === "ship" ? order.shipping_address : order.origin
        const score = scores.get(id) || { global: 0, local: 0 }
        score.global += quantity
        if (matchesBuyerArea(area, buyerGeo)) score.local += quantity
        scores.set(id, score)
      }
    }
  }
  return scores
}