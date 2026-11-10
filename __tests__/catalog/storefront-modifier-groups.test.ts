/** @jest-environment node */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock("@/app/price-lists/buyer-price-context", () => ({ getBuyerPriceContext: jest.fn(), getBuyerAssignments: jest.fn() }))
jest.mock("@/app/pos/actions/site-access", () => ({ requirePosSiteAccess: jest.fn() }))

import { createServiceClient } from "@/lib/supabase/server"
import { getBuyerPriceContext, getBuyerAssignments } from "@/app/price-lists/buyer-price-context"
import { getModifierGroupsForCatalogItem } from "@/app/catalog/modifier-actions"
import { getStorefrontModifierGroups } from "@/app/catalog/storefront-modifier-groups"

const HOST = "11111111-1111-4111-8111-111111111111"
const PARENT = "22222222-2222-4222-8222-222222222222"
type Row = Record<string, unknown>
let rows: Record<string, Row[]>
let failed: string | null
const reads: string[] = []
const from = jest.fn()
const fieldValue = (row: Row, field: string): unknown => field.split(".").reduce<unknown>(
  (value, part) => value && typeof value === "object" ? (value as Row)[part] : undefined, row,
)
function query(table: string) {
  const filters: ((row: Row) => boolean)[] = []
  let single = false
  let start = 0
  let end = Infinity
  const q = {
    select: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
    eq: (field: string, value: unknown) => { filters.push(row => fieldValue(row, field) === value); return q },
    is: (field: string, value: unknown) => { filters.push(row => fieldValue(row, field) === value); return q },
    in: (field: string, values: unknown[]) => { filters.push(row => values.includes(row[field])); return q },
    or: () => { filters.push(row => row.availability_mode !== "manual" || row.availability_status === "available"); return q },
    range: (a: number, b: number) => { start = a; end = b; return q },
    single: () => { single = true; return q },
    maybeSingle: () => { single = true; return q },
    then: (resolve: (result: unknown) => unknown) => {
      reads.push(table)
      const data = (rows[table] || []).filter(row => filters.every(filter => filter(row))).slice(start, end + 1)
      return Promise.resolve(resolve({ data: single ? data[0] || null : data, error: failed === table ? { message: "private database detail" } : null }))
    },
  }
  return q
}
function group(id: string, host = HOST, site = "site") {
  return { id: `link-${id}`, site_id: site, catalog_item_id: host, modifier_group_id: id,
    modifier_group: { id, site_id: site, name: id, min_select: 0, max_select: 2, sort_order: 0 } }
}
function option(id: string, groupId = "group", site = "site") {
  return { id: `row-${id}-${groupId}`, site_id: site, modifier_group_id: groupId, catalog_item_id: id, sort_order: 0,
    catalog_item: { id, site_id: site, status: "active", name: id, target_sale_price: 10, currency: "USD",
      description: "Option", image_url: null, category: { name: " Extras " } } }
}
beforeEach(() => {
  jest.clearAllMocks(); reads.length = 0; failed = null
  from.mockImplementation(query)
  jest.mocked(createServiceClient).mockResolvedValue({ from } as never)
  jest.mocked(getBuyerPriceContext).mockResolvedValue(null)
  jest.mocked(getBuyerAssignments).mockResolvedValue(new Map([["site", "personal"]]))
  rows = {
    catalog_items: [{ id: HOST, site_id: "site", parent_id: null, status: "active", is_marketplace_listed: true,
      availability_mode: "always", site: { id: "site", archived_at: null } }],
    catalog_item_modifier_groups: [group("group")],
    modifier_group_items: [option("extra")],
    price_lists: [
      { id: "default", site_id: "site", is_active: true, is_default: true, channels: ["shop", "marketplace"], currency: "EUR" },
      { id: "personal", site_id: "site", is_active: true, is_default: false, channels: ["shop", "marketplace"], currency: "GBP" },
    ],
    price_list_items: [
      { price_list_id: "default", site_id: "site", catalog_item_id: "extra", unit_price: 8 },
      { price_list_id: "personal", site_id: "site", catalog_item_id: "extra", unit_price: 6 },
    ],
  }
})
const load = (channel: "shop" | "marketplace" = "shop") => getModifierGroupsForCatalogItem(HOST, channel)
function signIn() {
  jest.mocked(getBuyerPriceContext).mockResolvedValue({ client: { from }, userId: "buyer", verifiedEmail: null, assignments: new Map() } as never)
}

it.each(["shop", "marketplace"] as const)("delegates %s and returns default price/currency in the existing DTO", async channel => {
  const result = await load(channel)
  expect(result.data[0].items[0]).toEqual({ id: "row-extra-group", catalog_item_id: "extra", sort_order: 0,
    name: "extra", price: 8, currency: "EUR", image_url: null, description: "Option", categoryName: "Extras" })
  expect(createServiceClient).toHaveBeenCalledWith(true, { access: "public" })
})
it("applies personal pricing after defaults, and missing personal rows use raw price/currency", async () => {
  signIn()
  expect((await load()).data[0].items[0]).toMatchObject({ price: 6, currency: "GBP" })
  rows.price_list_items = rows.price_list_items.filter(row => row.price_list_id !== "personal")
  expect((await load()).data[0].items[0]).toMatchObject({ price: 10, currency: "USD" })
})
it("honors channel eligibility for both default and personal lists", async () => {
  signIn()
  rows.price_lists.forEach(row => { row.channels = ["shop"] })
  expect((await load("marketplace")).data[0].items[0]).toMatchObject({ price: 10, currency: "USD" })
  expect((await load("shop")).data[0].items[0]).toMatchObject({ price: 6, currency: "GBP" })
})
it.each(["inactive", "unavailable", "archived", "unlisted"])("denies %s hosts before reading modifiers or prices", async state => {
  const host = rows.catalog_items[0]
  if (state === "inactive") host.status = "draft"
  if (state === "unavailable") { host.availability_mode = "manual"; host.availability_status = "unavailable" }
  if (state === "archived") host.site = { id: "site", archived_at: "2026-01-01" }
  if (state === "unlisted") host.is_marketplace_listed = false
  expect((await load("marketplace")).data).toEqual([])
  expect(reads).toEqual(["catalog_items"])
  expect(getBuyerPriceContext).not.toHaveBeenCalled()
})
it.each(["shop", "marketplace"] as const)("%s rejects private hosts but accepts listing inherited from a public parent", async channel => {
  rows.catalog_items[0].is_marketplace_listed = false
  expect((await load(channel)).data).toEqual([])
  rows.catalog_items[0].parent_id = PARENT
  rows.catalog_items.push({ id: PARENT, site_id: "site", status: "active", is_marketplace_listed: true })
  expect((await load(channel)).data).toHaveLength(1)
  rows.catalog_items[1].status = "draft"
  expect((await load(channel)).data).toEqual([])
  rows.catalog_items[1].status = "active"
  rows.catalog_items[1].availability_mode = "manual"
  rows.catalog_items[1].availability_status = "unavailable"
  expect((await load(channel)).data).toEqual([])
})
it("rejects cross-site links, groups, option links and option catalog items plus inactive options", async () => {
  rows.catalog_item_modifier_groups.push(group("foreign", HOST, "other"),
    { ...group("bad-group"), modifier_group: { ...group("bad-group").modifier_group, site_id: "other" } })
  rows.modifier_group_items.push(option("foreign", "group", "other"),
    { ...option("wrong-owner"), catalog_item: { ...option("wrong-owner").catalog_item, site_id: "other" } },
    { ...option("inactive"), catalog_item: { ...option("inactive").catalog_item, status: "draft" } })
  const result = await load()
  expect(result.data.map(g => g.id)).toEqual(["group"])
  expect(result.data[0].items.map(item => item.catalog_item_id)).toEqual(["extra"])
})
it("uses same-site parent fallback only when own links are absent", async () => {
  rows.catalog_items[0].parent_id = PARENT
  rows.catalog_items.push({ id: PARENT, site_id: "site", status: "active", is_marketplace_listed: true })
  rows.catalog_item_modifier_groups.push(group("parent-group", PARENT))
  expect((await load()).data.map(g => g.id)).toEqual(["group"])
  rows.catalog_item_modifier_groups.shift()
  expect((await load()).data.map(g => g.id)).toEqual(["parent-group"])
  rows.catalog_items[1].site_id = "other"
  expect((await load()).data).toEqual([])
})
it("batches options and prices across many groups without per-group reads", async () => {
  rows.catalog_item_modifier_groups = Array.from({ length: 30 }, (_, i) => group(`group-${i}`))
  rows.modifier_group_items = Array.from({ length: 30 }, (_, i) => option("extra", `group-${i}`))
  expect((await load()).data).toHaveLength(30)
  expect(reads).toEqual(["catalog_items", "catalog_item_modifier_groups", "modifier_group_items", "price_lists", "price_list_items"])
})
it("paginates options instead of silently dropping rows at the API row cap", async () => {
  rows.modifier_group_items = Array.from({ length: 501 }, (_, i) => option(`option-${i}`))
  expect((await load()).data[0].items).toHaveLength(501)
  expect(reads.filter(table => table === "modifier_group_items")).toHaveLength(2)
})
it("fails closed without leaking database details", async () => {
  failed = "modifier_group_items"
  expect(await load()).toEqual({ data: [], error: "Unable to load modifier groups" })
  expect(getBuyerPriceContext).not.toHaveBeenCalled()
})
it("validates channel and host ID before any read", async () => {
  expect(await getStorefrontModifierGroups(HOST, "pos" as never)).toEqual({ data: [] })
  expect(await getStorefrontModifierGroups("bad-id", "shop")).toEqual({ data: [] })
  expect(from).not.toHaveBeenCalled()
})
it("preserves no-channel workspace/POS behavior without buyer or channel prices", async () => {
  expect((await getModifierGroupsForCatalogItem(HOST)).data[0].items[0]).toMatchObject({ price: 10, currency: "USD" })
  expect(reads).toEqual(["catalog_items", "catalog_item_modifier_groups", "modifier_group_items"])
  expect(getBuyerPriceContext).not.toHaveBeenCalled()
})