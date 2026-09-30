/** @jest-environment node */

import { GET } from "@/app/api/marketplace/products/route"
import { loadMarketplaceHome } from "@/app/marketplace/load-marketplace-home"
import { getPdpCatalogItem, getPdpShareItem } from "@/app/commerce/pdp-actions"
import {
  getMarketplaceMerchandising,
  getShopMerchandising,
  getStorefrontPromotionDetail,
} from "@/app/promotions/storefront-promotions"
import { createServiceClient } from "@/lib/supabase/server"

jest.mock("next/cache", () => ({ unstable_cache: (load: () => unknown) => load }))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("@/app/marketplace/attach-site-settings", () => ({
  attachSiteSettings: async (_client: unknown, items: unknown[]) => items,
}))
jest.mock("@/app/price-lists/apply-channel-prices", () => ({
  applyChannelPricesToItems: async (_client: unknown, items: unknown[]) => items,
  loadChannelPriceMap: async () => ({ priceByItemId: new Map() }),
}))
jest.mock("@/app/catalog/variant-resolve", () => ({
  loadVariantListingPreviews: async () => new Map(),
  resolveVariantAxesForDisplay: (_item: unknown, children: unknown[]) => ({ children, axes: [] }),
}))
jest.mock("@/app/commerce/storefront-display", () => ({
  loadStorefrontDisplay: async () => new Map(),
}))

const activeSite = { id: "active-site", name: "Active", logo_url: null, archived_at: null }
const archivedSite = {
  id: "archived-site", name: "Archived", logo_url: null, archived_at: "2026-09-22T10:00:00Z",
}
const item = {
  id: "active-item",
  name: "Service",
  site_id: activeSite.id,
  site: activeSite,
  status: "active",
  is_marketplace_listed: true,
  parent_id: null,
  target_sale_price: 25,
  metadata: {},
}
const promotion = {
  id: "active-promo",
  site_id: activeSite.id,
  site: activeSite,
  status: "active",
  name: "Discount",
  show_on_marketplace: true,
  show_on_shop: true,
  channels: ["marketplace", "shop"],
  applies_to: "all",
}

function setup() {
  const tables: Record<string, any[]> = {
    catalog_items: [
      { ...item, id: "archived-item", site_id: archivedSite.id, site: archivedSite },
      item,
      { ...item, id: "inactive-item", status: "inactive" },
      { ...item, id: "private-item", is_marketplace_listed: false },
    ],
    promotions: [
      { ...promotion, id: "archived-promo", site_id: archivedSite.id, site: archivedSite },
      promotion,
    ],
  }
  const queries: Array<{ table: string; query: any }> = []
  const from = jest.fn((table: string) => {
    const filters: Array<(row: any) => boolean> = []
    let columns = ""
    let range: [number, number] | undefined
    const result = () => {
      const rows = (tables[table] || []).filter((row) => filters.every((filter) => filter(row)))
      return { data: range ? rows.slice(range[0], range[1] + 1) : rows, count: rows.length, error: null }
    }
    const query: any = {
      select: jest.fn((value) => { columns = value; return query }),
      eq: jest.fn((column, value) => {
        filters.push((row) => row[column] === value)
        return query
      }),
      is: jest.fn((column, value) => {
        if (column === "site.archived_at") {
          // Without an inner join an embedded filter does not exclude the parent row.
          filters.push((row) => !columns.includes("site:sites!inner(") || row.site?.archived_at === value)
        } else {
          filters.push((row) => row[column] === value)
        }
        return query
      }),
      in: jest.fn((column, values) => {
        filters.push((row) => values.includes(row[column]))
        return query
      }),
      or: jest.fn(() => query),
      order: jest.fn(() => query),
      limit: jest.fn((value) => { range = [0, value - 1]; return query }),
      range: jest.fn((start, end) => { range = [start, end]; return query }),
      single: jest.fn(async () => ({ data: result().data[0] || null, error: null })),
      maybeSingle: jest.fn(async () => ({ data: result().data[0] || null, error: null })),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    }
    queries.push({ table, query })
    return query
  })
  jest.mocked(createServiceClient).mockResolvedValue({ from } as any)
  return { from, queries }
}

function expectArchiveFilter(query: any) {
  expect(query.select.mock.calls[0][0]).toContain("site:sites!inner(")
  expect(query.is).toHaveBeenCalledWith("site.archived_at", null)
}

describe("archived-site marketplace exposure", () => {
  beforeEach(() => jest.clearAllMocks())

  it("excludes archived sites from home items, counts, and merchandising", async () => {
    const { queries } = setup()
    const result = await loadMarketplaceHome()

    expect(result.items.map((row: any) => row.id)).toEqual(["active-item"])
    expect(result.count).toBe(1)
    expect(result.initialTotalPages).toBe(1)
    expect(result.merchandising.discountsFeed.map((row) => row.id)).toEqual(["active-promo"])
    expectArchiveFilter(queries[0].query)
  })

  it("filters before API pagination and counts while retaining active listings", async () => {
    const { queries } = setup()
    const response = await GET(new Request("https://example.test/api/marketplace/products?limit=1"))
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.data.map((row: any) => row.id)).toEqual(["active-item"])
    expect(result).toMatchObject({ count: 1, totalPages: 1 })
    expectArchiveFilter(queries[0].query)
  })

  it("does not expose an archived seller through the API siteId filter", async () => {
    setup()
    const response = await GET(new Request("https://example.test/api/marketplace/products?siteId=archived-site"))
    expect(await response.json()).toMatchObject({ data: [], count: 0, totalPages: 0 })
  })

  describe.each([
    ["full product", getPdpCatalogItem],
    ["share metadata", getPdpShareItem],
  ] as const)("%s", (_label, load) => {
    it.each(["marketplace", "storefront"])("rejects archived %s products by direct ID", async (surface) => {
      const { from, queries } = setup()
      const options = surface === "marketplace" ? { requireMarketplace: true } : { requireStorefront: true }
      expect(await load("archived-item", options)).toBeNull()
      expect(from.mock.calls).toEqual([["catalog_items"]])
      expectArchiveFilter(queries[0].query)
    })

    it("still loads active marketplace products", async () => {
      setup()
      expect(await load("active-item", { requireMarketplace: true })).toEqual(
        expect.objectContaining({ name: "Service" })
      )
    })

    it("keeps unlisted products out of the marketplace", async () => {
      setup()
      expect(await load("private-item", { requireMarketplace: true })).toBeNull()
    })
  })

  it("excludes archived sites from a seller-scoped promotion feed", async () => {
    const { queries } = setup()
    expect(await getMarketplaceMerchandising({ siteIds: [archivedSite.id] })).toEqual({
      discountsFeed: [], byItemId: {},
    })
    expectArchiveFilter(queries[0].query)
  })

  it.each([
    [activeSite.id, ["active-promo"]],
    [archivedSite.id, []],
  ])("filters shop merchandising for %s", async (siteId, expectedIds) => {
    const { queries } = setup()
    const result = await getShopMerchandising({ siteId, siteSlug: "example" })
    expect(result.general.map((row) => row.id)).toEqual(expectedIds)
    expectArchiveFilter(queries[0].query)
  })

  it("does not load an archived promotion or its related records by direct ID", async () => {
    const { from, queries } = setup()
    expect(await getStorefrontPromotionDetail({ promotionId: "archived-promo" })).toEqual({
      error: "Promotion not found",
    })
    expect(from.mock.calls).toEqual([["promotions"]])
    expectArchiveFilter(queries[0].query)
  })

  it("still loads active promotion details", async () => {
    setup()
    expect(await getStorefrontPromotionDetail({ promotionId: "active-promo" })).toMatchObject({
      data: { id: "active-promo", catalog_item_ids: [], required_items: [] },
    })
  })
})