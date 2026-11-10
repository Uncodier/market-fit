/** @jest-environment node */
import { getStorefrontCartPrices } from "@/app/commerce/storefront-cart-prices"
import { createServiceClient } from "@/lib/supabase/server"
import { applyBuyerPricesToItems } from "@/app/price-lists/buyer-prices"

jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("@/app/price-lists/apply-channel-prices", () => ({ applyChannelPricesToItems: async (_client: unknown, items: unknown[]) => items }))
jest.mock("@/app/price-lists/buyer-prices", () => ({ applyBuyerPricesToItems: jest.fn(async (items: unknown[]) => items) }))
jest.mock("@/app/lib/fx-rates", () => ({ getUsdFxRates: async () => ({ rates: { EUR: 0.5 } }) }))
const uuid = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`
function setup(size = 1) {
  const hosts = Array.from({ length: size }, (_, index) => ({ id: uuid(index + 1), site_id: "site", is_marketplace_listed: true,
    currency: "EUR", target_sale_price: 10 }))
  const rows: Record<string, Record<string, unknown>[]> = {
    catalog_items: [...hosts, { id: uuid(999), site_id: "site", currency: "USD", target_sale_price: 4 },
      { id: uuid(888), site_id: "site", currency: "USD", target_sale_price: 99 }],
    catalog_item_modifier_groups: [{ catalog_item_id: hosts[0].id, site_id: "site", modifier_group_id: "group" }],
    modifier_group_items: [{ catalog_item_id: uuid(999), site_id: "site", modifier_group_id: "group" }],
    settings: [{ site_id: "site", currency: "USD" }],
  }
  const from = jest.fn((table: string) => {
    const filters: ((row: Record<string, unknown>) => boolean)[] = []
    const query: any = {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(), or: jest.fn().mockReturnThis(),
      in: (column: string, ids: unknown[]) => { filters.push(row => ids.includes(row[column])); return query },
      then: (resolve: (value: unknown) => void) => Promise.resolve({ data: rows[table].filter(row => filters.every(filter => filter(row))), error: null }).then(resolve),
    }
    return query
  })
  jest.mocked(createServiceClient).mockResolvedValue({ from } as any)
  return { from, hosts, rows }
}
beforeEach(() => jest.clearAllMocks())

it("uses a constant batch count for 1 or 100 products, includes only attached options and settles mixed currencies like checkout", async () => {
  for (const count of [1, 100]) {
    const { from, hosts } = setup(count)
    const result = await getStorefrontCartPrices({ channel: "shop", ids: hosts.map(host => host.id), modifierIds: [uuid(999), uuid(888)] })
    expect(from).toHaveBeenCalledTimes(5)
    expect(result.items).toHaveLength(count + 1)
    expect(result.items.find(item => item.id === hosts[0].id)).toMatchObject({ price: 20, currency: "USD" })
    expect(result.items.find(item => item.id === uuid(999))).toMatchObject({ price: 4, currency: "USD" })
    expect(result.items.find(item => item.id === uuid(888))).toBeUndefined()
  }
  expect(applyBuyerPricesToItems).toHaveBeenCalledTimes(2)
})

it("rejects malformed and excessive inputs before creating privileged clients", async () => {
  await expect(getStorefrontCartPrices({ channel: "shop", ids: ["invalid"], modifierIds: [] })).rejects.toThrow()
  await expect(getStorefrontCartPrices({ channel: "shop", ids: Array.from({ length: 201 }, (_, index) => uuid(index)), modifierIds: [] })).rejects.toThrow()
  expect(createServiceClient).not.toHaveBeenCalled()
})

it("never exposes prices of unlisted hosts", async () => {
  setup()
  const result = await getStorefrontCartPrices({ channel: "marketplace", ids: [uuid(888)], modifierIds: [] })
  expect(result.items).toEqual([])
})

it("does not expose a listed child whose parent is missing", async () => {
  const { rows } = setup()
  rows.catalog_items.push({ id: uuid(555), site_id: "site", parent_id: uuid(556),
    is_marketplace_listed: true, currency: "USD", target_sale_price: 22 })
  const result = await getStorefrontCartPrices({ channel: "shop", ids: [uuid(555)], modifierIds: [] })
  expect(result.items).toEqual([])
})