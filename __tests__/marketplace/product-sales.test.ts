/** @jest-environment node */
import { loadMarketplaceSales, readAllRows } from "@/app/marketplace/load-marketplace-sales"
import type { SupabaseClient } from "@supabase/supabase-js"

jest.mock("server-only", () => ({}))

const candidate = { id: "parent", site_id: "site", created_at: "2026-10-01" }
const order = { site_id: "site", status: "pending", fulfillment_method: "ship",
  shipping_address: { city: "Leon", country: "MX" }, origin: null,
  sale: { site_id: "site", status: "completed" } }
const baseLine = { catalog_item_id: "parent", site_id: "site", quantity: 3, status: "pending", order }

function client(lines: unknown[]) {
  const query = (data: unknown[]) => {
    const chain = (): Query => q
    type Query = { select: typeof chain; in: typeof chain; is: typeof chain; order: typeof chain;
      range: (from: number, to: number) => Promise<{ data: unknown[]; error: null }> }
    const q: Query = { select: jest.fn(chain), in: jest.fn(chain), is: jest.fn(chain), order: jest.fn(chain),
      range: jest.fn(async () => ({ data, error: null })) }
    return q
  }
  const childQuery = query([{ id: "child", parent_id: "parent", site_id: "site" },
    { id: "foreign-child", parent_id: "parent", site_id: "foreign" }])
  const lineQuery = query(lines)
  return { supabase: { from: (table: string) => table === "catalog_items" ? childQuery : lineQuery } as unknown as SupabaseClient,
    childQuery, lineQuery }
}

describe("marketplace sales aggregation", () => {
  it("counts paid parent and variant units, using buyer delivery area or pickup origin", async () => {
    const { supabase, lineQuery } = client([
      baseLine,
      { ...baseLine, catalog_item_id: "child", quantity: 4 },
      { ...baseLine, quantity: 2, order: { ...order, shipping_address: { city: "Other" } } },
      { ...baseLine, quantity: 1, order: { ...order, fulfillment_method: "pickup", origin: { city: "Leon", country: "Mexico" } } },
    ])
    const result = await loadMarketplaceSales(supabase, [candidate], { city: "Leon", country: "MX" })
    expect(result.get("parent")).toEqual({ global: 10, local: 8 })
    expect(lineQuery.in).toHaveBeenCalledWith("order.sale.status", ["completed", "paid"])
    expect(lineQuery.is).toHaveBeenCalledWith("parent_sale_order_item_id", null)
    expect(lineQuery.in).toHaveBeenCalledWith("catalog_item_id", ["parent", "child"])
  })
  it("excludes unpaid, cancelled, refunded, nonpositive and cross-tenant units", async () => {
    const { supabase } = client([
      baseLine,
      { ...baseLine, order: { ...order, sale: { ...order.sale, status: "pending" } } },
      { ...baseLine, order: { ...order, status: "cancelled" } },
      { ...baseLine, order: { ...order, status: "refunded" } },
      { ...baseLine, status: "cancelled" },
      { ...baseLine, quantity: 0 },
      { ...baseLine, quantity: -10 },
      { ...baseLine, quantity: "bad" },
      { ...baseLine, site_id: "foreign" },
      { ...baseLine, order: { ...order, site_id: "foreign" } },
      { ...baseLine, order: { ...order, sale: { ...order.sale, site_id: "foreign" } } },
      { ...baseLine, catalog_item_id: "foreign-child" },
    ])
    expect(await loadMarketplaceSales(supabase, [candidate])).toEqual(new Map([["parent", { global: 3, local: 0 }]]))
  })
  it("reads past row caps and propagates failures rather than fabricating rankings", async () => {
    const query = jest.fn(async (from: number) => ({ data: from === 0 ? Array.from({ length: 500 }, (_, i) => i) : [500], error: null }))
    expect(await readAllRows(query)).toHaveLength(501)
    expect(query.mock.calls).toEqual([[0, 499], [500, 999]])
    await expect(readAllRows(async () => ({ data: null, error: { message: "Unavailable" } }))).rejects.toThrow("Unavailable")
  })
})