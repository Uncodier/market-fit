/** @jest-environment node */

import { unstable_cache } from "next/cache"
import { createServiceClient } from "@/lib/supabase/server"
import { STOREFRONT_AVAILABILITY_OR } from "@/app/catalog/storefront-availability"
import { getShopCategoryOffsets } from "@/app/shop/[siteSlug]/shop-category-offsets"
import type { ShopCategoryOffset } from "@/app/shop/[siteSlug]/shop-catalog-shared"

jest.mock("next/cache", () => ({ unstable_cache: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))

type CatalogRow = { id: string; category: unknown }
type PageResponse = {
  data: CatalogRow[] | null
  count: number | null
  error: { message: string } | null
}

function catalogRow(id: number, category: unknown): CatalogRow {
  return { id: String(id), category }
}

function setupFallback(
  rows: CatalogRow[],
  serverMax = 1000,
  overrides: Record<number, Partial<PageResponse>> = {}
) {
  function makeQuery(page: number) {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn(async (start: number, end: number): Promise<PageResponse> => ({
        data: rows.slice(start, Math.min(end + 1, start + serverMax)),
        count: rows.length,
        error: null,
        ...overrides[page],
      })),
    }
  }

  const queries: ReturnType<typeof makeQuery>[] = []
  const from = jest.fn(() => {
    const query = makeQuery(queries.length)
    queries.push(query)
    return query
  })
  const rpc = jest.fn().mockResolvedValue({ data: null, error: { message: "RPC unavailable" } })
  jest.mocked(createServiceClient).mockResolvedValue(
    { from, rpc } as unknown as Awaited<ReturnType<typeof createServiceClient>>
  )
  return { from, rpc, queries }
}

describe("getShopCategoryOffsets", () => {
  const cache = new Map<string, ShopCategoryOffset[]>()

  beforeEach(() => {
    jest.clearAllMocks()
    cache.clear()
    // Model successful-result caching; a rejected loader must leave no cache entry.
    jest.mocked(unstable_cache).mockImplementation((load, keyParts) => async (...args) => {
      const key = JSON.stringify(keyParts)
      const cached = cache.get(key)
      if (cached) return cached
      const result = await load(...args)
      cache.set(key, result)
      return result
    })
  })

  it("normalizes the existing RPC name, offset, and count contract without querying catalog items", async () => {
    const { rpc, from } = setupFallback([])
    rpc.mockResolvedValue({
      data: [
        { name: "Brews", offset: "0", count: "3" },
        { name: null, offset: 3, count: 2 },
        { name: "", offset: null, count: null },
        { name: "Coffee", offset: "invalid", count: "invalid" },
      ],
      error: null,
    })

    await expect(getShopCategoryOffsets("site-a")).resolves.toEqual([
      { name: "Brews", offset: 0, count: 3 },
      { name: "Other", offset: 3, count: 2 },
      { name: "Other", offset: 0, count: 0 },
      { name: "Coffee", offset: 0, count: 0 },
    ])
    expect(createServiceClient).toHaveBeenCalledWith(true)
    expect(rpc).toHaveBeenCalledWith("shop_category_offsets", { p_site_id: "site-a" })
    expect(from).not.toHaveBeenCalled()
  })

  it("accepts an empty successful RPC response without using the fallback", async () => {
    const { rpc, from } = setupFallback([])
    rpc.mockResolvedValue({ data: [], error: null })

    await expect(getShopCategoryOffsets("site-a")).resolves.toEqual([])
    expect(from).not.toHaveBeenCalled()
  })

  it("counts interleaved categories across multiple fallback pages in first-seen order", async () => {
    const rows = Array.from({ length: 2005 }, (_, index) =>
      catalogRow(index, { name: index % 2 === 0 ? "Brews" : "Coffee" })
    )
    rows[1000] = catalogRow(1000, [{ name: "Tea" }])
    const { from, queries } = setupFallback(rows)

    await expect(getShopCategoryOffsets("site-a")).resolves.toEqual([
      { name: "Brews", offset: 0, count: 1002 },
      { name: "Coffee", offset: 1, count: 1002 },
      { name: "Tea", offset: 1000, count: 1 },
    ])
    expect(from.mock.calls).toEqual([["catalog_items"], ["catalog_items"], ["catalog_items"]])
    expect(queries.map((query) => query.range.mock.calls[0])).toEqual([
      [0, 999], [1000, 1999], [2000, 2999],
    ])
    for (const query of queries) {
      expect(query.select.mock.calls).toEqual([
        ["id, category:catalog_categories(name)", { count: "exact" }],
      ])
      expect(query.eq.mock.calls).toEqual([
        ["site_id", "site-a"], ["status", "active"], ["is_marketplace_listed", true],
      ])
      expect(query.is.mock.calls).toEqual([["parent_id", null]])
      expect(query.or.mock.calls).toEqual([[STOREFRONT_AVAILABILITY_OR]])
      expect(query.order.mock.calls).toEqual([
        ["sort_order", { ascending: true }],
        ["name", { ascending: true }],
        ["id", { ascending: true }],
      ])
      expect(query.order.mock.invocationCallOrder[2]).toBeLessThan(query.range.mock.invocationCallOrder[0])
    }
  })

  it("uses the exact count and actual rows returned when the server truncates pages below 1000", async () => {
    const { queries } = setupFallback([
      catalogRow(0, { name: "Brews" }),
      catalogRow(1, [{ name: "Coffee" }]),
      catalogRow(2, { name: "Brews" }),
      catalogRow(3, null),
      catalogRow(4, []),
      catalogRow(5, { name: "" }),
      catalogRow(6, { name: "Coffee" }),
    ], 2)

    await expect(getShopCategoryOffsets("site-a")).resolves.toEqual([
      { name: "Brews", offset: 0, count: 2 },
      { name: "Coffee", offset: 1, count: 2 },
      { name: "Other", offset: 3, count: 3 },
    ])
    expect(queries.map((query) => query.range.mock.calls[0])).toEqual([
      [0, 999], [2, 1001], [4, 1003], [6, 1005],
    ])
  })

  it("stops at the exact total without issuing an extra query for a full last page", async () => {
    const { queries } = setupFallback(
      Array.from({ length: 1000 }, (_, index) => catalogRow(index, { name: "Brews" }))
    )

    await expect(getShopCategoryOffsets("site-a")).resolves.toEqual([
      { name: "Brews", offset: 0, count: 1000 },
    ])
    expect(queries).toHaveLength(1)
  })

  it("falls back for non-array RPC data and returns an empty catalog only when its count is zero", async () => {
    const { rpc, queries } = setupFallback([])
    rpc.mockResolvedValue({ data: { name: "Brews", offset: 0, count: 1 }, error: null })

    await expect(getShopCategoryOffsets("site-a")).resolves.toEqual([])
    expect(queries).toHaveLength(1)
  })

  it("rejects a later-page error without caching partial counts, allowing a successful retry", async () => {
    const rows = [catalogRow(0, { name: "Brews" }), catalogRow(1, { name: "Coffee" })]
    setupFallback(rows, 1, { 1: { data: null, count: null, error: { message: "Query failed" } } })

    await expect(getShopCategoryOffsets("site-a")).rejects.toThrow("Unable to load shop category offsets")
    expect(cache.size).toBe(0)

    const { from } = setupFallback(rows, 1)
    await expect(getShopCategoryOffsets("site-a")).resolves.toEqual([
      { name: "Brews", offset: 0, count: 1 },
      { name: "Coffee", offset: 1, count: 1 },
    ])
    expect(from).toHaveBeenCalledTimes(2)
    expect(cache.size).toBe(1)
  })

  it.each([
    { data: null },
    { count: null },
    { count: -1 },
    { count: 1.5 },
    { data: [], count: 2 },
    { error: { message: "Query failed" } },
  ])("does not cache an incomplete or failed fallback response: %j", async (response) => {
    setupFallback([catalogRow(0, { name: "Brews" })], 1000, { 0: response })

    await expect(getShopCategoryOffsets("site-a")).rejects.toThrow(/shop category offsets/)
    expect(cache.size).toBe(0)
  })

  it("retains the site-scoped invalidation tag and TTL with the bumped cache version", async () => {
    const { rpc } = setupFallback([])
    rpc.mockResolvedValue({ data: [], error: null })

    await getShopCategoryOffsets("site-a")
    await getShopCategoryOffsets("site-b")

    expect(unstable_cache).toHaveBeenNthCalledWith(
      1, expect.any(Function), ["shop-category-offsets-v9", "site-a"],
      { revalidate: 60, tags: ["shop:site-a"] }
    )
    expect(unstable_cache).toHaveBeenNthCalledWith(
      2, expect.any(Function), ["shop-category-offsets-v9", "site-b"],
      { revalidate: 60, tags: ["shop:site-b"] }
    )
    expect(rpc).toHaveBeenCalledTimes(2)
  })
})