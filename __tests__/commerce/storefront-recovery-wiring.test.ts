/** @jest-environment node */
import { readFileSync } from "fs"
import { join } from "path"

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8")

it("keeps Shop's price-bearing sheet closed while the shared recovery sheet owns cart access", () => {
  const source = read("app/shop/[siteSlug]/ShopClient.tsx")
  expect(source).toContain("(pricingPending || pricingError) && <CartPricingRecovery items={cart}")
  expect(source).toContain("open={isCartOpen} onOpenChange={setIsCartOpen}")
  expect(source).toContain("isCartOpen={isCartOpen && !pricingPending && !pricingError}")
  expect(source).toContain("previous.filter(line => !ids.includes(cartLineKey(line)))")
  expect(source).toContain("pricingPending || pricingError ? e.preventDefault() : runShopCheckout")
  expect(read("app/shop/[siteSlug]/useShopCart.ts")).toContain('setCartItems("cart", "shop", siteId, cart)')
})

it("does not mount Marketplace's payment panel alongside the recovery sheet and persists edits", () => {
  const source = read("app/marketplace/MarketplaceClient.tsx")
  expect(source).toContain("(pricingPending || pricingError) && <CartPricingRecovery items={cart}")
  expect(source).toMatch(/isCartOpen && !pricingPending && !pricingError && \(\s*<MarketplaceCartPanel/)
  expect(source).toContain("previous.filter(line => !ids.includes(cartLineKey(line)))")
  expect(source).toContain('setCartItems("cart", "marketplace", null, cart)')
  expect(source).toContain("pricingPending || pricingError ? e.preventDefault() : runMarketplaceCheckout")
})