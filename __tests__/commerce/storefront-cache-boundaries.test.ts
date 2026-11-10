/** @jest-environment node */
import { loadMarketplaceHome } from "@/app/marketplace/load-marketplace-home"
import { loadMarketplaceProducts } from "@/app/marketplace/load-marketplace-products"
import { applyBuyerPricesToItems } from "@/app/price-lists/buyer-prices"

let inCache = false
let cached: unknown
jest.mock("next/cache", () => ({ unstable_cache: (load: () => Promise<unknown>) => async () => {
  if (cached !== undefined) return cached
  inCache = true
  try { cached = await load(); return cached } finally { inCache = false }
} }))
jest.mock("@/app/marketplace/load-marketplace-products", () => ({ loadMarketplaceProducts: jest.fn() }))
jest.mock("@/app/promotions/storefront-promotions", () => ({ getMarketplaceMerchandising: async () => ({}) }))
jest.mock("@/app/price-lists/buyer-prices", () => ({ applyBuyerPricesToItems: jest.fn() }))

it("shares only public base data while each request overlays its own buyer prices", async () => {
  cached = undefined
  const raw = [{ id: "product", site_id: "seller", target_sale_price: 30, currency: "USD",
    _buyerPriceBase: { target_sale_price: 40, currency: "USD" } }]
  jest.mocked(loadMarketplaceProducts).mockResolvedValue({ items: raw, count: 1, totalPages: 1, regions: [] } as any)
  let price = 12
  jest.mocked(applyBuyerPricesToItems).mockImplementation(async items => {
    expect(inCache).toBe(false)
    return items.map(item => ({ ...item, target_sale_price: price }))
  })
  expect((await loadMarketplaceHome()).items[0].target_sale_price).toBe(12)
  price = 25
  expect((await loadMarketplaceHome()).items[0].target_sale_price).toBe(25)
  expect(raw[0].target_sale_price).toBe(30)
  expect(loadMarketplaceProducts).toHaveBeenCalledTimes(1)
  expect(loadMarketplaceProducts).toHaveBeenCalledWith({}, true)
  expect(applyBuyerPricesToItems).toHaveBeenCalledTimes(2)
})