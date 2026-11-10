/** @jest-environment node */
import { getPdpCatalogItem } from "@/app/commerce/pdp-actions"
import { getShopCatalog } from "@/app/shop/[siteSlug]/actions"
import { applyBuyerPricesToItems } from "@/app/price-lists/buyer-prices"

const child = { id: "child", site_id: "seller", currency: "USD", target_sale_price: 40 }
const publicItem = { id: "parent", site_id: "seller", currency: "USD", target_sale_price: 20,
  _shop: { children: [child], hasVariants: true }, _buyerPriceBase: { currency: "USD", target_sale_price: 30 } }
jest.mock("server-only", () => ({}))
jest.mock("next/cache", () => ({ unstable_cache: (_load: unknown, keys: string[]) => async () =>
  keys[0].startsWith("pdp-") ? publicItem : { data: [publicItem], count: 1 } }))
jest.mock("@/app/book/actions", () => ({ getSiteInfoBySlug: jest.fn() }))
jest.mock("@/app/inventory/actions", () => ({ listPublicLocations: jest.fn() }))
jest.mock("@/app/price-lists/buyer-prices", () => ({ applyBuyerPricesToItems: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(applyBuyerPricesToItems).mockImplementation(async items => items.map(item => ({ ...item,
    target_sale_price: item.id === "child" ? 8 : 12, currency: "EUR" })))
})

it("overlays the cached PDP and all its variants in one buyer batch, without mutating public data", async () => {
  const item = await getPdpCatalogItem("parent", { requireMarketplace: true })
  expect(item).toMatchObject({ target_sale_price: 12, currency: "EUR",
    _shop: { children: [{ target_sale_price: 8, currency: "EUR" }] } })
  expect(applyBuyerPricesToItems).toHaveBeenCalledTimes(1)
  expect(applyBuyerPricesToItems).toHaveBeenCalledWith([publicItem, child], "marketplace")
  expect(publicItem.target_sale_price).toBe(20)
  expect(child.target_sale_price).toBe(40)
})

it("keeps cached images and kiosk PDPs public", async () => {
  expect(await getPdpCatalogItem("parent", { publicOnly: true })).toBe(publicItem)
  expect(applyBuyerPricesToItems).not.toHaveBeenCalled()
})

it("overlays Shop after the cached read and never personalizes a kiosk location", async () => {
  expect((await getShopCatalog("seller")).data[0].target_sale_price).toBe(12)
  expect(publicItem.target_sale_price).toBe(20)
  jest.mocked(applyBuyerPricesToItems).mockClear()
  expect((await getShopCatalog("seller", { selfServiceLocationId: "kiosk" })).data[0].target_sale_price).toBe(20)
  expect(applyBuyerPricesToItems).not.toHaveBeenCalled()
})