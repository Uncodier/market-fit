/** @jest-environment node */
jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getBuyerPriceContext, getBuyerAssignments, type BuyerPriceContext } from "@/app/price-lists/buyer-price-context"
import { applyBuyerPricesToItems, loadBuyerPriceMap } from "@/app/price-lists/buyer-prices"

const from = jest.fn()
const getUser = jest.fn()
type Row = Record<string, unknown>
let rows: Record<string, Row[]>
let failed: string | null
const queries: { table: string; filters: [string, string, unknown][] }[] = []
interface TestQuery {
  select: jest.Mock; order: jest.Mock; range: jest.Mock
  eq: jest.Mock<TestQuery, [string, unknown]>
  is: jest.Mock<TestQuery, [string, unknown]>
  in: jest.Mock<TestQuery, [string, unknown[]]>
  ilike: jest.Mock<TestQuery, [string, string]>
  then: (resolve: (value: unknown) => unknown) => Promise<unknown>
}
function mockQuery(table: string) {
  const filters: [string, string, unknown][] = []
  const query: TestQuery = {
    select: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
    eq: jest.fn((field: string, value: unknown) => { filters.push(["eq", field, value]); return query }),
    is: jest.fn((field: string, value: unknown) => { filters.push(["eq", field, value]); return query }),
    in: jest.fn((field: string, value: unknown[]) => { filters.push(["in", field, value]); return query }),
    ilike: jest.fn((field: string, value: string) => { filters.push(["ilike", field, value]); return query }),
    range: jest.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) => {
      queries.push({ table, filters })
      return Promise.resolve(resolve({ error: failed === table ? { message: "private" } : null,
        data: (rows[table] || []).filter(row => filters.every(([op, field, value]) =>
          op === "in" ? (value as unknown[]).includes(row[field]) : op === "ilike"
            ? String(row[field]).toLowerCase() === String(value).replace(/\\([_%\\])/g, "$1").toLowerCase()
            : row[field] === value)),
      }))
    },
  }
  return query
}
const base = { id: "item", site_id: "site", target_sale_price: 90, currency: "USD",
  _buyerPriceBase: { target_sale_price: 100, currency: "USD" } }
function context(): BuyerPriceContext {
  return { userId: "buyer", verifiedEmail: "buyer@example.test", client: { from } as never, assignments: new Map() }
}
beforeEach(() => {
  jest.clearAllMocks(); queries.length = 0; failed = null
  from.mockImplementation(mockQuery)
  rows = {
    leads: [{ id: "lead", site_id: "site", buyer_user_id: "buyer", email: "buyer@example.test", default_price_list_id: "vip" }],
    price_lists: [{ id: "vip", site_id: "site", is_active: true, currency: "EUR", channels: ["shop", "marketplace"] }],
    price_list_items: [{ site_id: "site", price_list_id: "vip", catalog_item_id: "item", unit_price: 70 }],
  }
  getUser.mockResolvedValue({ data: { user: { id: "buyer", email: "buyer@example.test", email_confirmed_at: "2026-01-01" } }, error: null })
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser } })
  jest.mocked(createServiceClient).mockResolvedValue({ from } as never)
})

it.each(["shop", "marketplace"] as const)("applies the buyer's %s price/currency without mutating public cached rows", async channel => {
  const result = await applyBuyerPricesToItems([base], channel, context())
  expect(result[0]).toMatchObject({ target_sale_price: 70, currency: "EUR" })
  expect(base.target_sale_price).toBe(90)
})
it("leaves anonymous prices untouched and performs no CRM queries", async () => {
  expect(await applyBuyerPricesToItems([base], "shop", null)).toEqual([base])
  expect(from).not.toHaveBeenCalled()
})
it.each([0, null, -1, "invalid"])("missing/invalid personal price %s uses raw catalog, not default list", async price => {
  rows.price_list_items[0].unit_price = price
  expect((await applyBuyerPricesToItems([base], "shop", context()))[0]).toMatchObject({ target_sale_price: 100, currency: "USD" })
})
it.each(["inactive", "wrong-channel", "foreign-site"])("ignores %s personal lists and preserves default pricing", async state => {
  if (state === "inactive") rows.price_lists[0].is_active = false
  if (state === "wrong-channel") rows.price_lists[0].channels = ["pos"]
  if (state === "foreign-site") rows.price_lists[0].site_id = "other"
  expect(await applyBuyerPricesToItems([base], "shop", context())).toEqual([base])
})
it("rejects legacy cross-tenant price-item rows", async () => {
  rows.price_list_items[0].site_id = "other"
  expect((await loadBuyerPriceMap([base], "shop", context())).priceByItemId.size).toBe(0)
})
it("matches an unlinked lead only by verified email, without claiming or updating it", async () => {
  rows.leads[0].buyer_user_id = null
  expect((await applyBuyerPricesToItems([base], "shop", context()))[0].target_sale_price).toBe(70)
  const unverified = { ...context(), verifiedEmail: null }
  expect(await applyBuyerPricesToItems([base], "shop", unverified)).toEqual([base])
})
it("never matches a lead already linked to a different buyer by email", async () => {
  rows.leads[0].buyer_user_id = "other"
  expect(await applyBuyerPricesToItems([base], "shop", context())).toEqual([base])
})
it("duplicate identities do not grant an arbitrary list; linked identity takes precedence", async () => {
  rows.leads.push({ ...rows.leads[0], id: "duplicate", buyer_user_id: null })
  expect((await getBuyerAssignments(context(), ["site"])).get("site")).toBe("vip")
  rows.leads[0].buyer_user_id = null
  expect((await getBuyerAssignments(context(), ["site"])).size).toBe(0)
})
it("batches items and memoizes assignment lookup within a buyer context", async () => {
  const buyer = context()
  await applyBuyerPricesToItems(Array.from({ length: 100 }, (_, i) => ({ ...base, id: `item-${i}` })), "shop", buyer)
  await applyBuyerPricesToItems([base], "shop", buyer)
  expect(queries.filter(query => query.table === "leads")).toHaveLength(2)
  expect(queries.filter(query => query.table === "price_list_items")).toHaveLength(2)
})
it.each(["leads", "price_lists", "price_list_items"])("fails closed on %s lookup error instead of charging a wrong fallback", async table => {
  failed = table
  await expect(applyBuyerPricesToItems([base], "shop", context())).rejects.toThrow(/buyer/)
})
it("does not share assignments between buyers", async () => {
  await getBuyerAssignments(context(), ["site"])
  const other = { ...context(), userId: "other", verifiedEmail: "other@example.test" }
  expect((await getBuyerAssignments(other, ["site"])).size).toBe(0)
})
it("authenticates before creating the narrow service reader", async () => {
  const buyer = await getBuyerPriceContext()
  expect(buyer?.userId).toBe("buyer")
  expect(buyer?.verifiedEmail).toBe("buyer@example.test")
  expect(createClient).toHaveBeenCalledWith(true)
  expect(createServiceClient).toHaveBeenCalledWith(true, { access: "public" })
})
it.each([null, { id: "anonymous", is_anonymous: true }])("does not create service access for guests", async user => {
  getUser.mockResolvedValue({ data: { user }, error: null })
  expect(await getBuyerPriceContext()).toBeNull()
  expect(createServiceClient).not.toHaveBeenCalled()
})
it("auth failures do not silently downgrade authenticated customers to public prices", async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthRetryableFetchError" } })
  await expect(getBuyerPriceContext()).rejects.toThrow("identity")
  expect(createServiceClient).not.toHaveBeenCalled()
})