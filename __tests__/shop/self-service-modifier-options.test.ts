/** @jest-environment node */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("@/app/shop/[siteSlug]/actions", () => ({ getShopSite: jest.fn() }))

import { createServiceClient } from "@/lib/supabase/server"
import { getShopSite } from "@/app/shop/[siteSlug]/actions"
import { loadSelfServiceModifierOptions } from "@/app/commerce/self-service-modifier-options"

const site = "11111111-1111-4111-8111-111111111111"
const branch = "22222222-2222-4222-8222-222222222222"
const host = "33333333-3333-4333-8333-333333333333"
const child = "44444444-4444-4444-8444-444444444444"
const group = { id: "group", site_id: site, name: "Extras", min_select: 1, max_select: 3, sort_order: 0 }
const request = { locationId: branch, hostId: host, fulfillment: "pickup" }
type Row = Record<string, unknown>
type Tables = Record<string, Row[]>

function product(id: string, extra: Row = {}): Row {
  return { id, site_id: site, name: id, kind: "product", status: "active", is_purchasable: true,
    availability_mode: "inventory", currency: "USD", target_sale_price: 2, ...extra }
}
function setup(extraItems: Row[] = []) {
  const optionIds = ["good", ...extraItems.map((item) => item.id as string)]
  const tables: Tables = {
    locations: [{ id: branch, site_id: site, is_active: true }],
    sites: [{ id: site, archived_at: null }],
    settings: [{ site_id: site, commerce: { stock_shortage_policy: "block" } }],
    catalog_items: [product(host, { is_marketplace_listed: true }), product(child, { parent_id: host }), product("good"), ...extraItems],
    catalog_item_modifier_groups: [{ site_id: site, catalog_item_id: host, modifier_group: group }],
    modifier_group_items: optionIds.map((id) => ({ id: `option-${id}`, site_id: site, modifier_group_id: group.id, catalog_item_id: id, sort_order: 0 })),
    inventory_levels: optionIds.map((id) => ({ site_id: site, location_id: branch, catalog_item_id: id, quantity: 4 })),
    price_lists: [{ id: "shop-list", site_id: site, currency: "USD", channels: ["shop"], is_default: true, is_active: true },
      { id: "pos-list", site_id: site, currency: "USD", channels: ["pos"], is_default: true, is_active: true }],
    price_list_items: [{ price_list_id: "shop-list", catalog_item_id: "good", unit_price: 7 }, { price_list_id: "pos-list", catalog_item_id: "good", unit_price: 99 }],
  }
  const calls: Array<{ table: string; column: string; value: unknown }> = []
  const from = jest.fn((table: string) => {
    let rows = [...(tables[table] || [])]
    const query = {
      select: jest.fn().mockReturnThis(),
      eq(column: string, value: unknown) { calls.push({ table, column, value }); rows = rows.filter((row) => row[column] === value); return this },
      is(column: string, value: unknown) { return this.eq(column, value) },
      in(column: string, values: unknown[]) { calls.push({ table, column, value: values }); rows = rows.filter((row) => values.includes(row[column])); return this },
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      maybeSingle() { return Promise.resolve({ data: rows[0] || null, error: null }) },
      then(resolve: (value: { data: Row[]; error: null }) => unknown) { return Promise.resolve({ data: rows, error: null }).then(resolve) },
    }
    return query
  })
  jest.mocked(createServiceClient).mockResolvedValue({ from })
  jest.mocked(getShopSite).mockResolvedValue({ id: site, name: "Shop", logo_url: null, settings: { shop: { self_service_fulfillment_options: ["pickup", "dine_in"] } } })
  return { tables, calls, from }
}

beforeEach(() => jest.clearAllMocks())

it("reads publicly without session credentials, scopes branch stock, and uses only Shop channel prices", async () => {
  const fixture = setup([product("empty"), product("elsewhere", { metadata: { pickup_location_ids: ["other"] } }),
    product("dine-only", { metadata: { delivery_options: ["dine_in"] } }), product("inactive", { status: "inactive" }),
    product("not-purchasable", { is_purchasable: false }), product("foreign", { site_id: "another-site" })])
  fixture.tables.inventory_levels = fixture.tables.inventory_levels.filter((row) => row.catalog_item_id !== "empty")
  fixture.tables.inventory_levels.push({ site_id: site, location_id: "other", catalog_item_id: "empty", quantity: 100 })
  const result = await loadSelfServiceModifierOptions(request)
  expect(result.error).toBeUndefined()
  expect(result.data[0].items).toEqual([expect.objectContaining({ catalog_item_id: "good", price: 7 })])
  expect(createServiceClient).toHaveBeenCalledWith(true, { access: "public" })
  expect(fixture.calls).toContainEqual({ table: "inventory_levels", column: "location_id", value: branch })
  expect(fixture.calls.filter((call) => ["catalog_items", "modifier_group_items", "catalog_item_modifier_groups"].includes(call.table) && call.column === "site_id").every((call) => call.value === site)).toBe(true)
})

it("inherits parent options unless the selected variant has its own groups", async () => {
  const { tables } = setup()
  expect((await loadSelfServiceModifierOptions({ ...request, selectedId: child })).data[0].id).toBe("group")
  tables.catalog_item_modifier_groups.push({ site_id: site, catalog_item_id: child, modifier_group: { ...group, id: "child-group", min_select: 0 } })
  tables.modifier_group_items.push({ id: "child-option", site_id: site, modifier_group_id: "child-group", catalog_item_id: "good", sort_order: 0 })
  expect((await loadSelfServiceModifierOptions({ ...request, selectedId: child })).data.map((row) => row.id)).toEqual(["child-group"])
})

it("checks an option's parent restrictions and merges inherited fulfillment settings", async () => {
  const { tables } = setup([product("variant-extra", { parent_id: "extra-parent" })])
  tables.catalog_items.push(product("extra-parent", { metadata: { delivery_options: ["dine_in"] } }))
  const pickup = await loadSelfServiceModifierOptions(request)
  expect(pickup.data[0].items.map((item) => item.catalog_item_id)).toEqual(["good"])
  const dineIn = await loadSelfServiceModifierOptions({ ...request, fulfillment: "dine_in" })
  expect(dineIn.data[0].items.map((item) => item.catalog_item_id)).toEqual(["good", "variant-extra"])
})

it.each(["inactive branch", "archived site", "private host", "foreign child", "inactive parent"])("denies %s before revealing groups", async (condition) => {
  const { tables, from } = setup()
  if (condition === "inactive branch") tables.locations[0].is_active = false
  if (condition === "archived site") tables.sites[0].archived_at = "2026-01-01"
  if (condition === "private host") tables.catalog_items[0].is_marketplace_listed = false
  if (condition === "foreign child") tables.catalog_items[1].parent_id = "other"
  if (condition === "inactive parent") tables.catalog_items[0].status = "inactive"
  const result = await loadSelfServiceModifierOptions({ ...request, selectedId: child })
  expect(result.data).toEqual([])
  expect(result.error).toBeTruthy()
  expect(from).not.toHaveBeenCalledWith("catalog_item_modifier_groups")
})

it("reports a useful host-unavailable reason if branch stock cannot fulfill a required minimum", async () => {
  const { tables } = setup()
  tables.catalog_item_modifier_groups[0].modifier_group = { ...group, min_select: 3 }
  tables.inventory_levels[0].quantity = 2
  const result = await loadSelfServiceModifierOptions(request)
  expect(result.unavailableReason).toMatch(/not enough options in Extras/)
  expect(result.data[0].min_select).toBe(3)
  tables.inventory_levels[0].quantity = 3
  expect((await loadSelfServiceModifierOptions(request)).unavailableReason).toBeUndefined()
})

it("keeps an empty required group instead of silently making it optional", async () => {
  const { tables } = setup()
  tables.inventory_levels = []
  const result = await loadSelfServiceModifierOptions(request)
  expect(result.data[0]).toMatchObject({ min_select: 1, items: [] })
  expect(result.unavailableReason).toMatch(/Please choose another item/)
})

it("preserves explicitly configured backorders instead of inventing a stricter modifier stock policy", async () => {
  const { tables } = setup()
  tables.settings[0].commerce = { stock_shortage_policy: "allow" }
  tables.inventory_levels = []
  const result = await loadSelfServiceModifierOptions(request)
  expect(result.data[0].items.map((item) => item.catalog_item_id)).toEqual(["good"])
  expect(result.unavailableReason).toBeUndefined()
})

it("rejects cross-tenant group joins and does not expose their options", async () => {
  const { tables, from } = setup()
  tables.catalog_item_modifier_groups[0].modifier_group = { ...group, site_id: "foreign" }
  const result = await loadSelfServiceModifierOptions(request)
  expect(result.error).toBeTruthy()
  expect(result.data).toEqual([])
  expect(from).not.toHaveBeenCalledWith("modifier_group_items")
})

it("validates malformed identifiers and fulfillment before any database access", async () => {
  setup()
  expect((await loadSelfServiceModifierOptions({ ...request, hostId: "invalid" })).error).toBeTruthy()
  expect((await loadSelfServiceModifierOptions({ ...request, fulfillment: "ship" })).error).toBeTruthy()
  expect(createServiceClient).not.toHaveBeenCalled()
})