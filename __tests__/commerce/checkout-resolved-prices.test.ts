/** @jest-environment node */
import { loadCheckoutResolvedPrices } from "@/app/commerce/checkout-line-reads"
import { createClient, createServiceClient } from "@/lib/supabase/server"

jest.mock("server-only", () => ({}))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))

type List = { id: string; site_id: string; is_default: boolean; is_active: boolean; channels: string[] }
function setup(options: { lists?: List[]; prices?: unknown[]; target?: number; missing?: boolean } = {}) {
  const lists = options.lists ?? [{ id: "default", site_id: "site", is_default: true, is_active: true, channels: ["pos"] }]
  const reads: { table: string; filters: Record<string, unknown> }[] = []
  const db = { from: (table: string) => {
    const filters: Record<string, unknown> = {}
    const result = async () => {
      reads.push({ table, filters })
      let rows: Record<string, unknown>[] = []
      if (table === "catalog_items") rows = options.missing ? [] : [{ id: "sku", target_sale_price: options.target ?? 20 }]
      if (table === "price_lists") rows = lists
      if (table === "price_list_items") rows = (options.prices ?? [7]).map((unit_price) => ({
        catalog_item_id: "sku", price_list_id: "default", unit_price,
      }))
      rows = rows.filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value))
      return { data: rows.length === 1 ? rows[0] : null, error: rows.length === 1 ? null : { message: "Not singular" } }
    }
    const query = { select: () => query, eq: (key: string, value: unknown) => { filters[key] = value; return query },
      single: result, maybeSingle: result }
    return query
  } }
  jest.mocked(createClient).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof createClient>>)
  jest.mocked(createServiceClient).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof createServiceClient>>)
  return reads
}
const request = { siteId: "site", lines: [{ catalogItemId: "sku", quantity: 1 }], isAdmin: false,
  priceListChannel: "pos" as const }
beforeEach(() => jest.clearAllMocks())

it.each([7, "8", 0, "0", null, -2, "invalid"])("retains actual resolver semantics for price-list value %p", async (value) => {
  setup({ prices: [value] })
  const price = (await loadCheckoutResolvedPrices(request)).get("sku")
  const expected = value === null || Number(value) === 0 ? 20 : Number(value) || 0
  expect(price).toBe(expected)
})

it("uses the tenant-scoped active default and preserves explicit missing/inactive list fallback", async () => {
  const reads = setup()
  expect((await loadCheckoutResolvedPrices(request)).get("sku")).toBe(7)
  expect(reads).toContainEqual({ table: "price_lists", filters: { site_id: "site", is_default: true, is_active: true } })
  expect((await loadCheckoutResolvedPrices({ ...request, finalPriceListId: "missing" })).get("sku")).toBe(20)
  setup({ lists: [{ id: "default", site_id: "site", is_default: true, is_active: false, channels: ["pos"] }] })
  expect((await loadCheckoutResolvedPrices({ ...request, finalPriceListId: "default" })).get("sku")).toBe(20)
})

it("preserves channel restrictions and unrestricted internal checkout", async () => {
  setup()
  expect((await loadCheckoutResolvedPrices({ ...request, priceListChannel: "shop" })).get("sku")).toBe(20)
  expect((await loadCheckoutResolvedPrices({ ...request, priceListChannel: null })).get("sku")).toBe(7)
})

it("retains singular-row handling for duplicate defaults and duplicate item prices", async () => {
  const list = { id: "default", site_id: "site", is_default: true, is_active: true, channels: ["pos"] }
  setup({ lists: [list, { ...list, id: "second" }] })
  expect((await loadCheckoutResolvedPrices(request)).get("sku")).toBe(20)
  setup({ prices: [7, 9] })
  expect((await loadCheckoutResolvedPrices(request)).get("sku")).toBe(20)
})

it("preserves missing-item fallback and selects service role only when requested", async () => {
  setup({ missing: true })
  expect((await loadCheckoutResolvedPrices(request)).get("sku")).toBe(0)
  expect(createServiceClient).not.toHaveBeenCalled()
  await loadCheckoutResolvedPrices({ ...request, isAdmin: true })
  expect(createServiceClient).toHaveBeenCalledWith(true)
})

it("skips clients entirely when all occurrences have trusted overrides", async () => {
  setup()
  expect((await loadCheckoutResolvedPrices({ ...request, lines: [
    { catalogItemId: "sku", quantity: 1, unitPriceOverride: 0 },
  ] })).size).toBe(0)
  expect(createClient).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
})