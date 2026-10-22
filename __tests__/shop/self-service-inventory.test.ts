/** @jest-environment node */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
import { enrichSelfServiceInventory } from "@/app/shop/[siteSlug]/self-service-catalog"
import type { CatalogItem } from "@/app/types"

const site = "55555555-5555-4555-8555-555555555555"
const location = "11111111-1111-4111-8111-111111111111"
const item = { id: "item", name: "Meal", site_id: site, kind: "product", availability_mode: "inventory", _shop: { sellable: true, availableQty: 100 } } as CatalogItem

function setup(policy = "block", active: unknown = { id: location }) {
  const chain = (data: unknown) => ({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data, error: null }), in: jest.fn().mockResolvedValue({ data, error: null }) })
  const tables = { locations: chain(active), sites: chain({ id: site }), settings: chain({ commerce: { stock_shortage_policy: policy } }),
    inventory_levels: chain([{ catalog_item_id: "child", quantity: 3 }]) }
  return { client: { from: jest.fn((table: keyof typeof tables) => tables[table]) }, tables }
}

it("replaces aggregated stock with branch stock and scopes all queries", async () => {
  const { client, tables } = setup()
  const result = await enrichSelfServiceInventory(site, location, [item], client)
  expect(result[0]._shop).toMatchObject({ sellable: false, availableQty: 0 })
  expect(tables.inventory_levels.eq).toHaveBeenCalledWith("location_id", location)
  expect(tables.inventory_levels.eq).toHaveBeenCalledWith("site_id", site)
  expect(tables.locations.eq).toHaveBeenCalledWith("is_active", true)
  expect(tables.sites.is).toHaveBeenCalledWith("archived_at", null)
})

it("updates actual variant children and preserves configured backorder policy", async () => {
  const { client } = setup("allow")
  const parent: CatalogItem = { ...item, _shop: { children: [{ ...item, id: "child" }] } }
  const result = await enrichSelfServiceInventory(site, location, [parent], client)
  expect(result[0]._shop?.sellable).toBe(true)
  expect(result[0]._shop?.children?.[0]._shop).toMatchObject({ sellable: true, availableQty: 3 })
})

it("denies inactive/foreign scope and malformed identifiers before inventory reads", async () => {
  const { client, tables } = setup("block", null)
  await expect(enrichSelfServiceInventory(site, location, [item], client)).rejects.toThrow("unavailable")
  expect(tables.inventory_levels.in).not.toHaveBeenCalled()
  await expect(enrichSelfServiceInventory("invalid", location, [item], client)).rejects.toThrow("Invalid self-service inventory scope")
})

it("keeps a variant listing purchasable when its child has branch stock even if parent stock is zero", async () => {
  const { client: base } = setup()
  const children = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({
    data: [{ id: "child", parent_id: "item", availability_mode: "inventory" }], error: null,
  }) }
  const client = { from: (table: string) => table === "catalog_items" ? children : base.from(table as Parameters<typeof base.from>[0]) }
  const result = await enrichSelfServiceInventory(site, location, [{ ...item, _shop: { hasVariants: true } }], client)
  expect(result[0]._shop).toMatchObject({ sellable: true, availableQty: 3, hasVariants: true })
})