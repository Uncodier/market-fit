/** @jest-environment node */
import { loadMarketplaceProducts } from "@/app/marketplace/load-marketplace-products"
import { createServiceClient } from "@/lib/supabase/server"
import { marketplaceItem } from "./catalog-fixture"

jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("@/app/marketplace/attach-site-settings", () => ({ attachSiteSettings: async (_client: unknown, items: unknown[]) => items }))
jest.mock("@/app/marketplace/load-marketplace-sales", () => ({ ...jest.requireActual("@/app/marketplace/load-marketplace-sales"), loadMarketplaceSales: async () => new Map() }))
jest.mock("@/app/catalog/variant-resolve", () => ({ loadVariantListingPreviews: async () => new Map() }))
jest.mock("@/app/commerce/storefront-display", () => ({ loadStorefrontDisplay: async () => new Map() }))
jest.mock("@/app/lib/fx-rates", () => ({ getUsdFxRates: async () => ({ rates: {} }) }))

function setup() {
  const items = Array.from({ length: 201 }, (_, index) => ({ ...marketplaceItem(`item-${index}`), site_id: "site", target_sale_price: 25 }))
  const tables: Record<string, Array<Record<string, unknown>>> = {
    catalog_items: items,
    price_lists: [{ id: "list", site_id: "site", currency: "USD", channels: ["marketplace"] }],
    price_list_items: [
      ...Array.from({ length: 1000 }, (_, index) => ({ price_list_id: "list", catalog_item_id: `unrelated-${index}`, unit_price: 1 })),
      ...items.map((item, index) => ({ price_list_id: "list", catalog_item_id: item.id, unit_price: index === 200 ? 100 : 125 })),
    ],
  }
  const client = { from: (table: string) => {
    const filters: Record<string, string[]> = {}
    let from = 0, to = 999
    const query = {
      select: () => query, eq: () => query, is: () => query, or: () => query, order: () => query,
      in: (column: string, values: string[]) => { filters[column] = values; return query },
      range: (start: number, end: number) => { from = start; to = end; return query },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: (tables[table] || [])
        .filter(row => Object.entries(filters).every(([column, ids]) => ids.includes(String(row[column])))).slice(from, to + 1), error: null })),
    }
    return query
  } }
  jest.mocked(createServiceClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createServiceClient>>)
}

it("actual loader filters and sorts 201 candidates using current list prices beyond 1000 unrelated overrides", async () => {
  setup()
  expect((await loadMarketplaceProducts({ maxPrice: 50 })).count).toBe(0)
  const filtered = await loadMarketplaceProducts({ minPrice: 100, maxPrice: 100 })
  expect(filtered.count).toBe(1)
  expect(filtered.items[0]).toMatchObject({ id: "item-200", target_sale_price: 100 })
  const sorted = await loadMarketplaceProducts({ sort: "price_asc", limit: 1 })
  expect(sorted.items[0]).toMatchObject({ id: "item-200", target_sale_price: 100 })
  expect(sorted.count).toBe(201)
})