/** @jest-environment node */
import type { SupabaseClient } from "@supabase/supabase-js"
import { applyChannelPricesToItems, loadChannelPriceMap } from "@/app/price-lists/apply-channel-prices"
import { filterMarketplacePrices } from "@/app/marketplace/marketplace-product-filters"

type Row = Record<string, string | number | string[]>
function fixture(tables: Record<string, Row[]>, fail?: string) {
  const calls: Array<{ table: string; filters: Record<string, string[]>; range?: number[] }> = []
  const client = { from: (table: string) => {
    const filters: Record<string, string[]> = {}
    let range: number[] | undefined
    const query = {
      select: () => query, eq: () => query, order: () => query,
      in: (column: string, values: string[]) => { filters[column] = values; return query },
      range: (from: number, to: number) => { range = [from, to]; return query },
      then: (resolve: (result: unknown) => unknown) => {
        calls.push({ table, filters, range })
        const rows = (tables[table] || []).filter(row => Object.entries(filters).every(([column, ids]) => ids.includes(String(row[column]))))
        return Promise.resolve(resolve({ data: rows.slice(range?.[0] || 0, Math.min((range?.[1] ?? 999) + 1, (range?.[0] || 0) + 1000)),
          error: table === fail ? { message: "private db detail" } : null }))
      },
    }
    return query
  } } as unknown as SupabaseClient
  return { client, calls }
}

const list = { id: "list", site_id: "site", currency: "USD", channels: ["marketplace"] }

it("201 candidates never drop ID filtering behind 1000 unrelated overrides; filtering and display both use 100, not 25", async () => {
  const items = Array.from({ length: 201 }, (_, index) => ({ id: `item-${index}`, site_id: "site", target_sale_price: 25, currency: "USD", created_at: "2026-10-01" }))
  const unrelated = Array.from({ length: 1000 }, (_, index) => ({ price_list_id: "list", catalog_item_id: `unrelated-${index}`, unit_price: 1 }))
  const prices = items.map(item => ({ price_list_id: "list", catalog_item_id: item.id, unit_price: 100 }))
  const { client, calls } = fixture({ price_lists: [list], price_list_items: [...unrelated, ...prices] })
  const priced = await applyChannelPricesToItems(client, items, "marketplace")
  expect(priced.every(item => item.target_sale_price === 100)).toBe(true)
  expect(filterMarketplacePrices(priced, { maxPrice: 50 }, {})).toEqual([])
  const selected = filterMarketplacePrices(priced, { minPrice: 100, maxPrice: 100 }, {})
  expect(selected).toHaveLength(201)
  expect((await applyChannelPricesToItems(client, selected.slice(200), "marketplace"))[0].target_sale_price).toBe(100)
  for (const call of calls) {
    expect(Object.values(call.filters).every(ids => ids.length <= 200)).toBe(true)
    if (call.table === "price_list_items") expect(call.filters.catalog_item_id.length).toBeGreaterThan(0)
  }
})

it("paginates each <=200 ID chunk, discards prices from another site's list, and chunks more than 200 sites", async () => {
  const items = Array.from({ length: 201 }, (_, index) => ({ id: `item-${index}`, site_id: `site-${index}`, target_sale_price: 25 }))
  const lists = items.map((item, index) => ({ ...list, id: `list-${index}`, site_id: item.site_id }))
  const wrong = Array.from({ length: 1200 }, (_, index) => ({ price_list_id: `list-${index % 199}`, catalog_item_id: "item-199", unit_price: 1 }))
  const prices = items.map((item, index) => ({ price_list_id: `list-${index}`, catalog_item_id: item.id, unit_price: 100 }))
  const { client, calls } = fixture({ price_lists: lists, price_list_items: [...wrong, ...prices] })
  expect((await applyChannelPricesToItems(client, items, "marketplace")).every(item => item.target_sale_price === 100)).toBe(true)
  expect(calls.some(call => call.table === "price_list_items" && call.range?.[0] === 1000)).toBe(true)
  expect(calls.filter(call => call.table === "price_lists").map(call => call.filters.site_id.length)).toEqual([200, 1])
})

it("paginates price lists too and accepts only the selected default list for an item's site", async () => {
  const lists = Array.from({ length: 1101 }, (_, index) => ({ ...list, id: `list-${String(index).padStart(4, "0")}` }))
  const { client, calls } = fixture({ price_lists: lists, price_list_items: [
    { price_list_id: "list-0000", catalog_item_id: "item", unit_price: 1 },
    { price_list_id: "list-1100", catalog_item_id: "item", unit_price: 100 },
  ] })
  expect((await loadChannelPriceMap(client, ["site"], "marketplace", ["item"])).priceByItemId.get("item")).toBe(100)
  expect(calls.filter(call => call.table === "price_lists").map(call => call.range?.[0])).toEqual([0, 500, 1000])
})

it.each(["price_lists", "price_list_items"])("fails explicitly on %s read errors instead of base-price fallback", async fail => {
  const { client } = fixture({ price_lists: [list] }, fail)
  await expect(applyChannelPricesToItems(client, [{ id: "item", site_id: "site", target_sale_price: 25 }], "marketplace")).rejects.toThrow("Unable to load channel")
})