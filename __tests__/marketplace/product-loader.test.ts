/** @jest-environment node */
import { loadMarketplaceProducts } from "@/app/marketplace/load-marketplace-products"
import { loadMarketplaceSales } from "@/app/marketplace/load-marketplace-sales"
import { createServiceClient } from "@/lib/supabase/server"
import { GET } from "@/app/api/marketplace/products/route"
import { marketplaceItem } from "./catalog-fixture"
import { searchCatalogWindow } from "@/lib/catalog-search/server"
import { CatalogSearchError } from "@/lib/catalog-search/server"

jest.mock("server-only", () => ({}))
jest.mock("@/lib/catalog-search/server", () => ({ searchCatalogWindow: jest.fn(), CatalogSearchError: jest.requireActual("@/lib/catalog-search/server").CatalogSearchError }))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("@/app/marketplace/load-marketplace-sales", () => ({
  ...jest.requireActual("@/app/marketplace/load-marketplace-sales"), loadMarketplaceSales: jest.fn(),
}))
jest.mock("@/app/marketplace/attach-site-settings", () => ({
  attachSiteSettings: async (_client: unknown, items: unknown[]) => items,
}))
jest.mock("@/app/price-lists/apply-channel-prices", () => ({
  applyChannelPricesToItems: async (_client: unknown, items: Array<{ id: string; target_sale_price: number }>) =>
    items.map(item => ({ ...item, target_sale_price: item.id === "top" ? 1 : item.target_sale_price })),
}))
jest.mock("@/app/catalog/variant-resolve", () => ({ loadVariantListingPreviews: async () => new Map() }))
jest.mock("@/app/commerce/storefront-display", () => ({ loadStorefrontDisplay: async () => new Map() }))
jest.mock("@/app/lib/fx-rates", () => ({ getUsdFxRates: async () => ({ rates: {} }) }))

type Row = Record<string, unknown>
function setup() {
  const rows = Array.from({ length: 501 }, (_, index) => ({ ...marketplaceItem(String(index)),
    target_sale_price: index + 10, created_at: "2026-10-01T00:00:00Z",
    metadata: { show_buyers: true, private_prompt: "private" },
  }))
  rows[500].id = "top"
  rows[500].site_id = "seller-two"
  rows[0].availability_mode = "inventory"
  const hydrated: string[][] = []
  const from = jest.fn((table: string) => {
    const filters: Array<(row: Row) => boolean> = []
    let range: number[] | undefined
    const result = () => {
      const tableRows: Row[] = table === "catalog_items" ? rows : table === "settings" ? [
        { site_id: "seller-one", locations: [{ city: "Leon", country: "MX" }] },
        { site_id: "seller-two", locations: [{ city: "New York", country: "US" }] },
      ] : []
      const data = tableRows.filter(row => filters.every(filter => filter(row)))
      return { data: range ? data.slice(range[0], range[1] + 1) : data, error: null }
    }
    const chain = (): Query => query
    type Query = { select: (columns: string) => Query; is: typeof chain; eq: typeof chain; or: typeof chain;
      order: typeof chain; in: (column: string, ids: string[]) => Query;
      range: (start: number, end: number) => Query;
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise<unknown> }
    const query: Query = {
      select: jest.fn(chain), is: jest.fn(chain), eq: jest.fn(chain), or: jest.fn(chain), order: jest.fn(chain),
      in: jest.fn((column, ids) => {
        filters.push(row => ids.includes(String(row[column])))
        if (table === "catalog_items" && column === "id") hydrated.push(ids)
        return query
      }),
      range: jest.fn((start, end) => { range = [start, end]; return query }),
      then: resolve => Promise.resolve(result()).then(resolve),
    }
    return query
  })
  jest.mocked(createServiceClient).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createServiceClient>>)
  jest.mocked(loadMarketplaceSales).mockResolvedValue(new Map([["top", { global: 100, local: 0 }]]))
  return { from, hydrated }
}

beforeEach(() => jest.clearAllMocks())

it.each(["matched", "related", undefined] as const)("preserves %s in Marketplace hydration and public GET metadata", async result_kind => {
  setup()
  jest.mocked(searchCatalogWindow).mockResolvedValue({ success: true,
    items: [{ id: "3", site_id: "seller-one" }], count: 1, count_kind: "candidate_window",
    has_more: false, mode: "hybrid", degraded: false, search_id: "search", result_kind,
    candidate_window_truncated: result_kind !== "related" })
  expect(await loadMarketplaceProducts({ search: "comfortable" })).toMatchObject({
    count: 1, result_kind: result_kind ?? "matched", candidate_window_truncated: result_kind !== "related" })
  const response = await GET(new Request("https://example.test/api/marketplace/products?search=comfortable"))
  expect(await response.json()).toMatchObject({ result_kind: result_kind ?? "matched", candidate_window_truncated: result_kind !== "related" })
})

it("uses bounded shared search order, not sales or an all-catalog candidate scan", async () => {
  const { hydrated } = setup()
  jest.mocked(searchCatalogWindow).mockResolvedValue({ success: true,
    items: [{ id: "3", site_id: "seller-one" }, { id: "top", site_id: "seller-two" }],
    count: 2, count_kind: "candidate_window", has_more: false, mode: "hybrid", degraded: false, search_id: "search" })
  const response = await loadMarketplaceProducts({ search: "semantic", limit: 1, sort: "best_selling" })
  expect(response.items.map(item => item.id)).toEqual(["3"])
  expect(response).toMatchObject({ count: 2, count_kind: "candidate_window", totalPages: 2 })
  expect(hydrated).toEqual([["3", "top"], ["3"]])
  expect(loadMarketplaceSales).not.toHaveBeenCalled()
  const mexico = await loadMarketplaceProducts({ search: "semantic", regionCountry: "MX" })
  expect(mexico.items.map(item => item.id)).toEqual(["3"])
  expect(mexico.count).toBe(1)
})

it("keeps whitespace browse and does not call shared search", async () => {
  setup()
  await loadMarketplaceProducts({ search: "   " })
  expect(searchCatalogWindow).not.toHaveBeenCalled()
})

it("uses 36 items for SSR and API pages without overlapping or dropping the final page", async () => {
  setup()
  const first = await loadMarketplaceProducts()
  const response = await GET(new Request("https://example.test/api/marketplace/products?page=2"))
  const second = await response.json()
  const last = await loadMarketplaceProducts({ page: 14 })

  expect(first).toMatchObject({ count: 501, totalPages: 14 })
  expect(first.items).toHaveLength(36)
  expect(response.status).toBe(200)
  expect(second).toMatchObject({ page: 2, limit: 36, count: 501, totalPages: 14 })
  expect(second.data).toHaveLength(36)
  expect(new Set([...first.items, ...second.data].map(item => item.id)).size).toBe(72)
  expect(last.items).toHaveLength(33)
  expect((await loadMarketplaceProducts({ page: 15 })).items).toEqual([])
})

it("ranks the full catalog beyond the row cap before paging and hydrates only that page", async () => {
  const { hydrated } = setup()
  const first = await loadMarketplaceProducts({ limit: 1 })
  expect(first).toMatchObject({ count: 501, totalPages: 501 })
  expect(first.items.map(item => item.id)).toEqual(["top"])
  expect(loadMarketplaceSales).toHaveBeenCalledWith(expect.anything(), expect.arrayContaining([expect.objectContaining({ id: "top" })]), undefined)
  expect(hydrated.every(ids => ids.length === 1 && ids[0] === "top")).toBe(true)
  const second = await loadMarketplaceProducts({ page: 2, limit: 1 })
  expect(second.items[0].id).not.toBe("top")
})

it("sorts channel-adjusted prices before pagination and does not load sales for price/newest", async () => {
  setup()
  expect((await loadMarketplaceProducts({ sort: "price_asc", limit: 1 })).items[0].id).toBe("top")
  await loadMarketplaceProducts({ sort: "newest", limit: 1 })
  expect(loadMarketplaceSales).not.toHaveBeenCalled()
})

it("does not return seller private metadata in listing responses", async () => {
  setup()
  const item = (await loadMarketplaceProducts({ limit: 1 })).items[0]
  expect(item.metadata).toMatchObject({ show_buyers: true })
  expect(item.metadata).not.toHaveProperty("private_prompt")
})

it("combines region and price filters before ranking, pagination and facet counts", async () => {
  setup()
  const mexico = await loadMarketplaceProducts({ regionCountry: "MX", limit: 1 })
  expect(mexico.count).toBe(500)
  expect(mexico.items[0].id).not.toBe("top")
  expect(mexico.regions).toEqual([
    { country: "mexico", label: "Mexico", count: 500 },
    { country: "united states", label: "United States", count: 1 },
  ])
  const cheap = await loadMarketplaceProducts({ minPrice: 1, maxPrice: 1, limit: 1 })
  expect(cheap.count).toBe(1)
  expect(cheap.items[0].id).toBe("top")
  expect(cheap.regions).toEqual([{ country: "united states", label: "United States", count: 1 }])
  const noMatch = await loadMarketplaceProducts({ minPrice: 1, maxPrice: 1, regionCountry: "MX" })
  expect(noMatch).toMatchObject({ count: 0, totalPages: 0, items: [] })
  expect(noMatch.regions).toHaveLength(1)
})

it("filters near me and available inventory across all candidates, not just the first page", async () => {
  setup()
  const nearby = await loadMarketplaceProducts({ nearMe: true, buyerGeo: { city: "Leon", country: "Mexico" }, limit: 1 })
  expect(nearby.count).toBe(500)
  expect(nearby.items[0].id).not.toBe("top")
  const available = await loadMarketplaceProducts({ availableOnly: true, limit: 1 })
  expect(available.count).toBe(500)
  expect(available.items[0].id).toBe("top")
  expect(available.regions[0]).toMatchObject({ country: "mexico", count: 499 })
})

it("rejects invalid requests before accessing privileged data and hides database errors", async () => {
  setup()
  expect((await GET(new Request("https://example.test/api/marketplace/products?sort=bad"))).status).toBe(400)
  expect(createServiceClient).not.toHaveBeenCalled()
  jest.mocked(createServiceClient).mockRejectedValueOnce(new Error("private database detail"))
  const log = jest.spyOn(console, "error").mockImplementation(() => undefined)
  const response = await GET(new Request("https://example.test/api/marketplace/products"))
  expect(response.status).toBe(500)
  expect(await response.json()).toEqual({ error: "Unable to load marketplace products" })
  log.mockRestore()
})

it("parses expected search_id, forwards it on page 2, and preserves expired snapshot 409 to the frontend", async () => {
  setup()
  const id = "11111111-1111-4111-8111-111111111111"
  jest.mocked(searchCatalogWindow).mockRejectedValueOnce(new CatalogSearchError(409, "Catalog search expired"))
  const response = await GET(new Request(`https://example.test/api/marketplace/products?search=shoes&page=2&search_id=${id}`))
  expect(response.status).toBe(409)
  expect(searchCatalogWindow).toHaveBeenCalledWith(expect.objectContaining({ query: "shoes", search_id: id }))
  expect((await GET(new Request("https://example.test/api/marketplace/products?search_id=invalid"))).status).toBe(400)
})