/** @jest-environment node */
import type { SupabaseClient } from "@supabase/supabase-js"
import { loadMarketplaceAreas } from "@/app/marketplace/load-marketplace-regions"
import { filterMarketplaceAvailability } from "@/app/marketplace/load-marketplace-availability"

jest.mock("server-only", () => ({}))
type Row = Record<string, unknown>
function mockClient(tables: Record<string, Row[]>) {
  const queries: Array<{ table: string; columns: string; filters: Array<[string, unknown]> }> = []
  const from = (table: string) => {
    const entry = { table, columns: "", filters: [] as Array<[string, unknown]> }
    queries.push(entry)
    const filters: Array<(row: Row) => boolean> = []
    const chain = (): Query => q
    type Query = { select: (columns: string) => Query; in: (column: string, values: string[]) => Query;
      eq: (column: string, value: unknown) => Query; order: typeof chain;
      range: (start: number, end: number) => Promise<{ data: Row[]; error: null }> }
    const q: Query = {
      select: columns => { entry.columns = columns; return q },
      in: (column, values) => { entry.filters.push([column, values]); filters.push(row => values.includes(String(row[column]))); return q },
      eq: (column, value) => { entry.filters.push([column, value]); filters.push(row => row[column] === value); return q },
      order: chain,
      range: async (start, end) => ({ data: (tables[table] || []).filter(row => filters.every(f => f(row))).slice(start, end + 1), error: null }),
    }
    return q
  }
  return { supabase: { from } as unknown as SupabaseClient, queries }
}
const item = (id: string, mode = "always", purchasable = true) => ({ id, site_id: "site", created_at: "2026-10-01", availability_mode: mode, availability_status: "available", is_purchasable: purchasable })

it("reads only public geography for already-authorized sellers and active locations", async () => {
  const { supabase, queries } = mockClient({
    settings: [{ site_id: "site", locations: [{ city: "Leon", country: "MX" }, null, "bad"] },
      { site_id: "foreign", locations: [{ country: "US" }] }],
    locations: [{ site_id: "site", country: "Mexico", city: "Celaya", is_active: true },
      { site_id: "site", country: "US", is_active: false }],
  })
  const areas = await loadMarketplaceAreas(supabase, [item("one")])
  expect(areas.get("site")).toEqual([{ city: "Leon", country: "MX" }, { city: "Celaya", country: "Mexico" }])
  expect(areas.has("foreign")).toBe(false)
  expect(queries[0].columns).toBe("site_id, locations")
  expect(queries[1].filters).toContainEqual(["is_active", true])
  expect(queries.every(query => query.filters.some(([key, values]) => key === "site_id" && JSON.stringify(values) === '["site"]'))).toBe(true)
})

it("Available now filters stock before pagination, ignores foreign stock and includes purchasable variants", async () => {
  const items = [item("always"), item("stock", "inventory"), item("empty", "inventory"), item("variant-parent", "always", false), item("not-purchasable", "always", false), { ...item("manual", "manual"), availability_status: "unavailable" }]
  const { supabase } = mockClient({
    catalog_items: [{ ...item("child", "inventory"), parent_id: "variant-parent", status: "active" }],
    inventory_levels: [{ catalog_item_id: "stock", site_id: "site", quantity: 2 },
      { catalog_item_id: "child", site_id: "site", quantity: 1 },
      { catalog_item_id: "empty", site_id: "foreign", quantity: 100 }],
  })
  expect((await filterMarketplaceAvailability(supabase, items)).map(row => row.id)).toEqual(["always", "stock", "variant-parent"])
})