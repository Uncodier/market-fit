import {
  PDP_ADD_TO_CART_PRIMARY_AFTER,
  afterAddToCartHref,
  isAddToCartPrimary,
} from "@/app/components/commerce/pdp/pdp-purchase-cta"

describe("isAddToCartPrimary", () => {
  it("keeps Buy Now primary for micro catalogs", () => {
    expect(isAddToCartPrimary(0)).toBe(false)
    expect(isAddToCartPrimary(PDP_ADD_TO_CART_PRIMARY_AFTER)).toBe(false)
  })

  it("makes Add to Cart primary once the catalog has more than five listings", () => {
    expect(isAddToCartPrimary(PDP_ADD_TO_CART_PRIMARY_AFTER + 1)).toBe(true)
  })
})

describe("afterAddToCartHref", () => {
  it("returns to the catalog without opening the drawer on mobile", () => {
    expect(afterAddToCartHref("/shop/cafe", 375)).toBe("/shop/cafe")
    expect(afterAddToCartHref("/marketplace", 767)).toBe("/marketplace")
  })

  it("opens the cart drawer on desktop", () => {
    expect(afterAddToCartHref("/shop/cafe", 768)).toBe("/shop/cafe?cart=1")
    expect(afterAddToCartHref("/marketplace", 1280)).toBe("/marketplace?cart=1")
  })

  it("appends cart=1 when the catalog URL already has a query", () => {
    expect(afterAddToCartHref("/marketplace?filter=product", 1024)).toBe(
      "/marketplace?filter=product&cart=1",
    )
  })
})
