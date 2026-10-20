/** @jest-environment node */
import { randomUUID } from "node:crypto"
import { loadShopSearch } from "@/app/shop/[siteSlug]/search-catalog"
import { getShopCatalog } from "@/app/shop/[siteSlug]/actions"
import { searchCatalogWindow } from "@/lib/catalog-search/server"
import { createServiceClient } from "@/lib/supabase/server"
import { STOREFRONT_AVAILABILITY_OR } from "@/app/catalog/storefront-availability"
import { marketplaceItem } from "../marketplace/catalog-fixture"
import { unstable_cache } from "next/cache"
import { getItemDeliveryOptions, intersectDeliveryOptions, isItemCompatibleWithFulfillment } from "@/app/commerce/delivery-options"
import { getItemPaymentOptions, intersectPaymentOptions } from "@/app/commerce/payment-options"
import { slimCartItem } from "@/app/commerce/cart-storage"
import { publicListingMetadata } from "@/app/catalog/public-listing-metadata"

jest.mock("server-only", () => ({}))
jest.mock("@/app/shop/[siteSlug]/search-catalog", () => {
  const actual = jest.requireActual("@/app/shop/[siteSlug]/search-catalog")
  return { ...actual, loadShopSearch: jest.fn(actual.loadShopSearch) }
})
jest.mock("@/lib/catalog-search/server", () => ({ searchCatalogWindow: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))
jest.mock("next/cache", () => ({ unstable_cache: jest.fn() }))
jest.mock("@/app/book/actions", () => ({ getSiteInfoBySlug: jest.fn() }))
jest.mock("@/app/inventory/actions", () => ({ listPublicLocations: jest.fn() }))
jest.mock("@/app/price-lists/apply-channel-prices", () => ({ loadChannelPriceMap: jest.fn() }))
jest.mock("@/app/catalog/variant-resolve", () => ({ loadVariantListingPreviews: jest.fn() }))
jest.mock("@/app/commerce/storefront-display", () => ({ loadStorefrontDisplay: jest.fn() }))

const siteId = randomUUID()
const first = randomUUID(), second = randomUUID(), foreign = randomUUID()
const options = { siteId, search: "soft shoes", offset: 0, pageSize: 1, category: "all" }
const enrich = jest.fn(async (_site, items) => items)
const queries: Array<Record<string, jest.Mock>> = []

beforeEach(() => {
  jest.clearAllMocks()
  queries.length = 0
  jest.mocked(searchCatalogWindow).mockResolvedValue({ success: true,
    items: [first, second, foreign].map(id => ({ id, site_id: siteId })), count: 3,
    count_kind: "candidate_window", has_more: false, mode: "hybrid", degraded: false, search_id: randomUUID() })
  const rows = [second, first, foreign].map(id => ({ ...marketplaceItem(id), site_id: id === foreign ? randomUUID() : siteId,
    metadata: { show_buyers: true, delivery_options: ["pickup"], payment_options: ["cash_on_pickup"], private_prompt: "must not escape" } }))
  const from = jest.fn((table: string) => {
    let ids: string[] | undefined
    const result = () => ({ data: table === "catalog_categories" ? [{ id: second }] : rows.filter(row => !ids || ids.includes(row.id)), error: null })
    const query: Record<string, jest.Mock> = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(), in: jest.fn((column, values) => { if (column === "id") ids = values; return query }),
      then: jest.fn(resolve => Promise.resolve(result()).then(resolve)),
    }
    queries.push(query)
    return query
  })
  jest.mocked(createServiceClient).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createServiceClient>>)
})

it("preserves rank, excludes wrong-site IDs, and hydrates only the requested page", async () => {
  const response = await loadShopSearch(options, enrich)
  expect(response.data.map(item => item.id)).toEqual([first])
  expect(response).toMatchObject({ count: 2, count_kind: "candidate_window", totalPages: 2, has_more: true })
  expect(enrich).toHaveBeenCalledWith(siteId, [expect.objectContaining({ id: first })], expect.anything())
  expect(queries[1].in).toHaveBeenCalledWith("id", [first])
  expect(response.data[0].metadata).not.toHaveProperty("private_prompt")
  expect(queries[1].select.mock.calls[0][0]).not.toContain("*,")
})

it.each([true, false, undefined])("forwards only explicit overflow metadata (%s), independently of hydrated count", async truncated => {
  const original = await jest.mocked(searchCatalogWindow)({ query: "shoes", channel: "shop", site_id: siteId })
  jest.mocked(searchCatalogWindow).mockResolvedValue({ ...original, candidate_window_truncated: truncated })
  expect(await loadShopSearch(options, enrich)).toMatchObject({ count: 2, candidate_window_truncated: truncated === true })
})

it.each(["matched", "related", undefined] as const)("preserves search classification through Shop hydration and action (%s)", async result_kind => {
  const original = await jest.mocked(searchCatalogWindow)({ query: "shoes", channel: "shop", site_id: siteId })
  jest.mocked(searchCatalogWindow).mockResolvedValue({ ...original, result_kind })
  const response = await loadShopSearch(options, enrich)
  expect(response).toMatchObject({ count: 2, result_kind: result_kind ?? "matched" })
  jest.mocked(loadShopSearch).mockResolvedValueOnce(response)
  expect(await getShopCatalog(siteId, { search: "shoes", pageSize: 1 })).toMatchObject({ result_kind: result_kind ?? "matched" })
})

it("keeps pickup-only browse and search compatible with the same actual cart fulfillment/payment utilities", async () => {
  const browse = { ...marketplaceItem(first), metadata: { delivery_options: ["pickup"] as const, payment_options: ["cash_on_pickup"] as const } }
  const searched = (await loadShopSearch(options, enrich)).data[0]
  const cart = slimCartItem(searched)
  for (const item of [browse, searched, cart]) {
    const commerceItem = { kind: searched.kind, metadata: {
      delivery_options: item.metadata?.delivery_options,
      payment_options: item.metadata?.payment_options,
    } }
    expect(isItemCompatibleWithFulfillment(commerceItem, "ship")).toBe(false)
    expect(isItemCompatibleWithFulfillment(commerceItem, "pickup")).toBe(true)
    expect(intersectDeliveryOptions([{ allowed: getItemDeliveryOptions(commerceItem) }])).toEqual(["pickup"])
    expect(intersectPaymentOptions([{ allowed: getItemPaymentOptions(commerceItem) }])).toEqual(["cash_on_pickup"])
  }
  expect(cart.metadata).not.toHaveProperty("private_prompt")
})

it("public delivery/payment projection rejects objects and unknown methods without exposing private metadata", () => {
  const metadata = publicListingMetadata({ delivery_options: ["pickup", "unknown", { prompt: "private" }, "pickup"],
    payment_options: ["cash_on_pickup", "unknown", { prompt: "private" }], agent_prompt: "private" } as never)
  expect(metadata?.delivery_options).toEqual(["pickup"])
  expect(metadata?.payment_options).toEqual(["cash_on_pickup"])
  expect(JSON.stringify(metadata)).not.toContain("private")
  expect(publicListingMetadata({ delivery_options: "pickup", payment_options: {} } as never)).toMatchObject({
    delivery_options: undefined, payment_options: undefined,
  })
})

it("rechecks tenant, active/listed parents, non-archived sellers and storefront availability on both reads", async () => {
  await loadShopSearch(options, enrich)
  for (const query of queries) {
    expect(query.eq).toHaveBeenCalledWith("site_id", siteId)
    expect(query.eq).toHaveBeenCalledWith("status", "active")
    expect(query.eq).toHaveBeenCalledWith("is_marketplace_listed", true)
    expect(query.is).toHaveBeenCalledWith("parent_id", null)
    expect(query.is).toHaveBeenCalledWith("site.archived_at", null)
    expect(query.or).toHaveBeenCalledWith(STOREFRONT_AVAILABILITY_OR)
  }
})

it("maps category names and uncategorized to the shared filter and rechecks during hydration", async () => {
  await loadShopSearch({ ...options, category: "Footwear" }, enrich)
  expect(searchCatalogWindow).toHaveBeenLastCalledWith(expect.objectContaining({ filters: expect.objectContaining({ category_id: second }) }))
  expect(queries[1].in).toHaveBeenCalledWith("category_id", [second])
  await loadShopSearch({ ...options, category: "Other" }, enrich)
  expect(searchCatalogWindow).toHaveBeenLastCalledWith(expect.objectContaining({ filters: expect.objectContaining({ category_id: null }) }))
  expect(queries[3].is).toHaveBeenCalledWith("category_id", null)
})

it("returns a safe visible error for query failures without cached browse or name fallback", async () => {
  jest.mocked(searchCatalogWindow).mockRejectedValueOnce(new Error("private backend detail"))
  expect(await getShopCatalog(siteId, { search: "running", pageSize: 20 })).toMatchObject({ error: "Unable to search this shop. Please try again." })
  expect(unstable_cache).not.toHaveBeenCalled()
})

it("retains cached browse for a whitespace query without invoking search", async () => {
  jest.mocked(unstable_cache).mockReturnValue((async () => ({ data: [], count: 0 })) as never)
  await getShopCatalog(siteId, { search: "   " })
  expect(searchCatalogWindow).not.toHaveBeenCalled()
  expect(unstable_cache).toHaveBeenCalled()
})